// 勤怠管理ユーティリティ — 純関数・型定義（サーバー/クライアント共有）
// DB アクセスを持たないためクライアントコンポーネントから安全にimportできる

/** 1日分の従業員勤怠データ */
export interface DailyAttendanceRecord {
    employeeId: string;
    employeeName: string;
    clockIn: string | null; // ISO UTC
    clockOut: string | null; // ISO UTC
    workMinutes: number | null;
    nightMinutes: number | null;
    status: "working" | "completed" | "no_punch";
}

export interface StoreOption {
    id: string;
    name: string;
}

/**
 * JST の日付文字列（YYYY-MM-DD）から営業日の UTC 範囲を返す。
 * 営業日区切りは JST 05:00〜翌 05:00（docs/kashio_phase1_scope_v1.2.md 準拠）。
 * JST 05:00 = UTC 前日 20:00 に相当する。
 */
export function getDateUTCRange(dateStr: string): { start: string; end: string } {
    // JST オフセット 9h から営業日オフセット 5h を差し引いた 4h をUTC基準で減算する
    const businessDayOffsetMs = 4 * 60 * 60 * 1000; // JST 05:00 = UTC 前日+20h = UTC 当日-4h
    const [year, month, day] = dateStr.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, day) - businessDayOffsetMs).toISOString();
    const end = new Date(Date.UTC(year, month - 1, day + 1) - businessDayOffsetMs).toISOString();
    return { start, end };
}

/**
 * 営業日基準の「今日」の JST 日付を YYYY-MM-DD 形式で返す。
 * JST 00:00〜04:59 は前日の営業日扱い（docs/kashio_phase1_scope_v1.2.md 準拠）。
 */
export function getTodayJST(): string {
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const businessDayStartHour = 5; // 営業日開始: JST 05:00
    const now = new Date(Date.now() + jstOffsetMs);
    const jstHour = now.getUTCHours();
    // JST 05:00 未満（00:00〜04:59）は前の営業日
    if (jstHour < businessDayStartHour) {
        now.setUTCDate(now.getUTCDate() - 1);
    }
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD の前日・翌日を返す */
export function getAdjacentDate(
    dateStr: string,
    direction: "prev" | "next"
): string {
    const [year, month, day] = dateStr.split("-").map(Number);
    const base = new Date(Date.UTC(year, month - 1, day));
    const offset = direction === "prev" ? -1 : 1;
    base.setUTCDate(base.getUTCDate() + offset);
    const y = base.getUTCFullYear();
    const m = String(base.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(base.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

/**
 * 深夜時間（分）を計算する。
 * 深夜帯: 22:00〜翌 5:00（JST）
 * clockOutISO が null の場合は現在時刻を使って概算する（勤務中扱い）。
 */
export function calcNightMinutes(
    clockInISO: string,
    clockOutISO: string | null
): number {
    const clockIn = new Date(clockInISO);
    const clockOut = clockOutISO ? new Date(clockOutISO) : new Date();

    if (clockOut.getTime() <= clockIn.getTime()) return 0;

    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const clockInJST = new Date(clockIn.getTime() + jstOffsetMs);
    const clockOutJST = new Date(clockOut.getTime() + jstOffsetMs);

    // 開始日（JST）から終了日（JST）まで日ごとに深夜帯との重複を計算
    const startDateUTC = Date.UTC(
        clockInJST.getUTCFullYear(),
        clockInJST.getUTCMonth(),
        clockInJST.getUTCDate()
    );
    const endDateUTC = Date.UTC(
        clockOutJST.getUTCFullYear(),
        clockOutJST.getUTCMonth(),
        clockOutJST.getUTCDate()
    );

    let nightMinutes = 0;
    let cursor = startDateUTC;

    while (cursor <= endDateUTC) {
        const cursorDate = new Date(cursor);
        const y = cursorDate.getUTCFullYear();
        const mo = cursorDate.getUTCMonth();
        const d = cursorDate.getUTCDate();

        // この日 22:00 JST 〜 翌 5:00 JST（UTC で表現）
        const night22 = new Date(Date.UTC(y, mo, d, 22) - jstOffsetMs).getTime();
        const night05 = new Date(Date.UTC(y, mo, d + 1, 5) - jstOffsetMs).getTime();

        const overlapStart = Math.max(clockIn.getTime(), night22);
        const overlapEnd = Math.min(clockOut.getTime(), night05);

        if (overlapEnd > overlapStart) {
            nightMinutes += Math.floor((overlapEnd - overlapStart) / 60000);
        }

        cursor += 24 * 60 * 60 * 1000;
    }

    return nightMinutes;
}

export type AttendancePunchType = "clock_in" | "clock_out";

export interface AttendancePunchRecord {
    employee_id: string;
    punch_type: AttendancePunchType;
    punched_at: string;
}

export interface AttendanceEmployee {
    employeeId: string;
    employeeName: string;
}

interface PunchPair {
    clockIn: string;
    clockOut: string | null;
}

/**
 * 日別ビュー用に、打刻一覧から従業員ごとの勤怠レコードを組み立てる純関数。
 *
 * 【05:00 またぎの扱い（docs/kashio_phase1_scope_v1.2.md 準拠）】
 * - clock_in は営業日範囲 [start, end) 内のものだけを対象にする（lookback なし）
 * - clock_out が end を超えるペアは 05:00 またぎエラーとして未退勤（working）扱いとする
 * - このためペアリングは clockOut <= end の場合のみ成立とする
 */
export function buildDailyAttendanceRecords(params: {
    employees: AttendanceEmployee[];
    punches: AttendancePunchRecord[];
    start: string;
    end: string;
    dateStr: string;
    todayJST?: string;
    nowMs?: number;
}): DailyAttendanceRecord[] {
    const {
        employees,
        punches,
        start,
        end,
        dateStr,
        todayJST = getTodayJST(),
        nowMs = Date.now(),
    } = params;

    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();

    const punchPairsByEmployee = new Map<string, PunchPair[]>();

    // clock_in は [start, end) 内のもののみ収集（05:00 またぎ防止のため lookback なし）
    for (const p of punches) {
        const pMs = new Date(p.punched_at).getTime();
        if (p.punch_type === "clock_in" && pMs >= startMs && pMs < endMs) {
            const pairs = punchPairsByEmployee.get(p.employee_id) ?? [];
            pairs.push({ clockIn: p.punched_at, clockOut: null });
            punchPairsByEmployee.set(p.employee_id, pairs);
        }
    }

    // clock_out は end 以内のもののみペアに対応（end を超えた場合は 05:00 またぎエラー）
    for (const p of punches) {
        if (p.punch_type !== "clock_out") continue;
        const pairs = punchPairsByEmployee.get(p.employee_id);
        if (!pairs || pairs.length === 0) continue;

        const pOutMs = new Date(p.punched_at).getTime();
        if (pOutMs > endMs) continue; // 05:00 またぎ：このペアは open のまま（working 扱い）
        for (const pair of pairs) {
            if (pair.clockOut !== null) continue;
            const pInMs = new Date(pair.clockIn).getTime();
            if (pOutMs >= pInMs) {
                pair.clockOut = p.punched_at;
                break;
            }
        }
    }

    const records = employees.map((employee) => {
        const pairs = punchPairsByEmployee.get(employee.employeeId) ?? [];

        let workMinutes: number | null = null;
        let nightMinutes: number | null = null;
        let status: DailyAttendanceRecord["status"] = "no_punch";

        if (pairs.length > 0) {
            const hasUnpaired = pairs.some((p) => p.clockOut === null);
            status = hasUnpaired ? "working" : "completed";

            let totalWorkMs = 0;
            let totalNightMinutes = 0;

            for (const pair of pairs) {
                const pInMs = new Date(pair.clockIn).getTime();
                if (pair.clockOut) {
                    const pOutMs = new Date(pair.clockOut).getTime();
                    totalWorkMs += pOutMs - pInMs;
                    totalNightMinutes += calcNightMinutes(pair.clockIn, pair.clockOut);
                } else if (dateStr === todayJST) {
                    const overlapEndMs = Math.min(nowMs, endMs);
                    if (overlapEndMs > pInMs) {
                        totalWorkMs += overlapEndMs - pInMs;
                        totalNightMinutes += calcNightMinutes(
                            pair.clockIn,
                            new Date(overlapEndMs).toISOString()
                        );
                    }
                }
            }

            if (hasUnpaired && dateStr !== todayJST) {
                workMinutes = null;
                nightMinutes = null;
            } else {
                workMinutes = Math.max(0, Math.floor(totalWorkMs / 60000));
                nightMinutes = totalNightMinutes;
            }
        }

        return {
            employeeId: employee.employeeId,
            employeeName: employee.employeeName,
            clockIn: pairs[0]?.clockIn ?? null,
            clockOut: pairs[pairs.length - 1]?.clockOut ?? null,
            workMinutes,
            nightMinutes,
            status,
        } satisfies DailyAttendanceRecord;
    });

    const order: Record<DailyAttendanceRecord["status"], number> = {
        working: 0,
        no_punch: 1,
        completed: 2,
    };
    return records.sort((a, b) => order[a.status] - order[b.status]);
}

// ─── 月次集計 ───────────────────────────────────────────────

/** 店舗別の月次勤怠サマリー */
export interface MonthlyStoreBreakdown {
    storeId: string;
    storeName: string;
    workMinutes: number;
    nightMinutes: number;
}

/** 従業員の月次勤怠サマリー */
export interface MonthlyAttendanceSummary {
    employeeId: string;
    employeeName: string;
    storeBreakdowns: MonthlyStoreBreakdown[];
    totalWorkMinutes: number;
    totalNightMinutes: number;
}

/** 人別ビューの明細行 */
export interface MonthlyAttendanceDetailRow {
    dateStr: string; // YYYY-MM-DD (JST営業日)
    storeId: string;
    storeName: string;
    clockIn: string;
    clockOut: string | null;
    workMinutes: number | null;
    nightMinutes: number | null;
    status: "working" | "completed";
}

/** 月次集計用の打刻レコード（store_id を含む） */
export interface MonthlyPunchRecord {
    employee_id: string;
    punch_type: AttendancePunchType;
    punched_at: string;
    store_id: string;
}

/**
 * YYYY-MM 形式の月から月全体の UTC 範囲を返す（営業日区切り JST 05:00 適用）。
 * 範囲は 1日目の JST 05:00（UTC 前日 20:00）〜 末日の翌日 JST 05:00 まで。
 */
export function getMonthUTCRange(yearMonth: string): {
    start: string;
    end: string;
    firstDay: string;
    lastDay: string;
} {
    const [year, month] = yearMonth.split("-").map(Number);
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDayNum = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;
    const { start } = getDateUTCRange(firstDay);
    const { end } = getDateUTCRange(lastDay);
    return { start, end, firstDay, lastDay };
}

/** YYYY-MM の前月・翌月を返す */
export function getAdjacentMonth(
    yearMonth: string,
    direction: "prev" | "next"
): string {
    const [year, month] = yearMonth.split("-").map(Number);
    const base = new Date(Date.UTC(year, month - 1, 1));
    base.setUTCMonth(base.getUTCMonth() + (direction === "prev" ? -1 : 1));
    const y = base.getUTCFullYear();
    const m = String(base.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

/** 現在月の YYYY-MM を返す（JST 基準） */
export function getCurrentMonth(): string {
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const now = new Date(Date.now() + jstOffsetMs);
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

/**
 * 月全体の打刻一覧から従業員の月次勤怠サマリーを組み立てる純関数。
 *
 * - clock_in は月の UTC 範囲 [start, end) 内のものを対象にする
 * - 月末をまたぐペア（clockOut が end を超える）は月次合計に含める（月内分のみ計算）
 * - 未退勤（clockOut === null）は勤務時間 0 として扱う（月次集計の確定値のみ対象）
 */
export function buildMonthlyAttendanceSummary(params: {
    employeeId: string;
    employeeName: string;
    punches: MonthlyPunchRecord[];
    stores: StoreOption[];
    start: string;
    end: string;
}): MonthlyAttendanceSummary {
    const { employeeId, employeeName, punches, stores, start, end } = params;

    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();

    const storeMap = new Map(stores.map((s) => [s.id, s.name]));
    const breakdownMap = new Map<
        string,
        { workMinutes: number; nightMinutes: number }
    >();

    // 従業員の打刻のみ抽出
    const empPunches = punches.filter((p) => p.employee_id === employeeId);

    // 店舗別に clock_in を収集し、対応する clock_out とペアにする
    const openPairsByStore = new Map<string, { clockIn: string }[]>();

    for (const p of empPunches) {
        const pMs = new Date(p.punched_at).getTime();
        if (p.punch_type === "clock_in" && pMs >= startMs && pMs < endMs) {
            const pairs = openPairsByStore.get(p.store_id) ?? [];
            pairs.push({ clockIn: p.punched_at });
            openPairsByStore.set(p.store_id, pairs);
        }
    }

    // clock_out をペアに対応付け
    const completedPairsByStore = new Map<
        string,
        { clockIn: string; clockOut: string | null }[]
    >();
    for (const [storeId, pairs] of openPairsByStore) {
        completedPairsByStore.set(
            storeId,
            pairs.map((p) => ({ ...p, clockOut: null }))
        );
    }

    for (const p of empPunches) {
        if (p.punch_type !== "clock_out") continue;
        const pairs = completedPairsByStore.get(p.store_id);
        if (!pairs || pairs.length === 0) continue;
        const pOutMs = new Date(p.punched_at).getTime();
        if (pOutMs > endMs) continue; // 05:00 またぎは未退勤扱い（月次確定値に含めない）
        for (const pair of pairs) {
            if (pair.clockOut !== null) continue;
            const pInMs = new Date(pair.clockIn).getTime();
            if (pOutMs >= pInMs) {
                pair.clockOut = p.punched_at;
                break;
            }
        }
    }

    // 店舗別集計
    for (const [storeId, pairs] of completedPairsByStore) {
        let workMinutes = 0;
        let nightMinutes = 0;
        for (const pair of pairs) {
            if (!pair.clockOut) continue; // 未退勤は月次確定値に含めない
            const pInMs = new Date(pair.clockIn).getTime();
            const pOutMs = Math.min(
                new Date(pair.clockOut).getTime(),
                endMs // 月末またぎの場合は月末で切り捨て
            );
            if (pOutMs > pInMs) {
                workMinutes += Math.floor((pOutMs - pInMs) / 60000);
                nightMinutes += calcNightMinutes(
                    pair.clockIn,
                    new Date(pOutMs).toISOString()
                );
            }
        }
        if (workMinutes > 0 || nightMinutes > 0) {
            breakdownMap.set(storeId, { workMinutes, nightMinutes });
        }
    }

    const storeBreakdowns: MonthlyStoreBreakdown[] = [];
    for (const [storeId, breakdown] of breakdownMap) {
        storeBreakdowns.push({
            storeId,
            storeName: storeMap.get(storeId) ?? storeId,
            workMinutes: breakdown.workMinutes,
            nightMinutes: breakdown.nightMinutes,
        });
    }
    // 店舗名昇順
    storeBreakdowns.sort((a, b) => a.storeName.localeCompare(b.storeName, "ja"));

    const totalWorkMinutes = storeBreakdowns.reduce(
        (acc, s) => acc + s.workMinutes,
        0
    );
    const totalNightMinutes = storeBreakdowns.reduce(
        (acc, s) => acc + s.nightMinutes,
        0
    );

    return {
        employeeId,
        employeeName,
        storeBreakdowns,
        totalWorkMinutes,
        totalNightMinutes,
    };
}

/** ISO UTC を JST 営業日（05:00区切り）の YYYY-MM-DD に変換 */
function toBusinessDateJST(isoUtc: string): string {
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const businessDayStartHour = 5;
    const d = new Date(new Date(isoUtc).getTime() + jstOffsetMs);
    if (d.getUTCHours() < businessDayStartHour) {
        d.setUTCDate(d.getUTCDate() - 1);
    }
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/** 月全体の打刻一覧から人別ビューの明細行を組み立てる */
export function buildMonthlyAttendanceDetailRows(params: {
    employeeId: string;
    punches: MonthlyPunchRecord[];
    stores: StoreOption[];
    start: string;
    end: string;
}): MonthlyAttendanceDetailRow[] {
    const { employeeId, punches, stores, start, end } = params;
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const storeMap = new Map(stores.map((s) => [s.id, s.name]));

    const empPunches = punches.filter((p) => p.employee_id === employeeId);
    const pairsByStore = new Map<string, { clockIn: string; clockOut: string | null }[]>();

    for (const p of empPunches) {
        const pMs = new Date(p.punched_at).getTime();
        if (p.punch_type === "clock_in" && pMs >= startMs && pMs < endMs) {
            const pairs = pairsByStore.get(p.store_id) ?? [];
            pairs.push({ clockIn: p.punched_at, clockOut: null });
            pairsByStore.set(p.store_id, pairs);
        }
    }

    for (const p of empPunches) {
        if (p.punch_type !== "clock_out") continue;
        const pairs = pairsByStore.get(p.store_id);
        if (!pairs || pairs.length === 0) continue;
        const pOutMs = new Date(p.punched_at).getTime();
        if (pOutMs > endMs) continue; // 05:00 またぎは未退勤扱い
        for (const pair of pairs) {
            if (pair.clockOut !== null) continue;
            const pInMs = new Date(pair.clockIn).getTime();
            if (pOutMs >= pInMs) {
                pair.clockOut = p.punched_at;
                break;
            }
        }
    }

    const rows: MonthlyAttendanceDetailRow[] = [];
    for (const [storeId, pairs] of pairsByStore) {
        for (const pair of pairs) {
            const pInMs = new Date(pair.clockIn).getTime();
            const storeName = storeMap.get(storeId) ?? storeId;
            if (!pair.clockOut) {
                rows.push({
                    dateStr: toBusinessDateJST(pair.clockIn),
                    storeId,
                    storeName,
                    clockIn: pair.clockIn,
                    clockOut: null,
                    workMinutes: null,
                    nightMinutes: null,
                    status: "working",
                });
                continue;
            }

            const pOutMs = new Date(pair.clockOut).getTime();
            if (pOutMs <= pInMs) continue;

            const boundedOutMs = Math.min(pOutMs, endMs);
            rows.push({
                dateStr: toBusinessDateJST(pair.clockIn),
                storeId,
                storeName,
                clockIn: pair.clockIn,
                clockOut: pair.clockOut,
                workMinutes: Math.floor((boundedOutMs - pInMs) / 60000),
                nightMinutes: calcNightMinutes(
                    pair.clockIn,
                    new Date(boundedOutMs).toISOString()
                ),
                status: "completed",
            });
        }
    }

    rows.sort((a, b) => {
        const aMs = new Date(a.clockIn).getTime();
        const bMs = new Date(b.clockIn).getTime();
        return aMs - bMs;
    });

    return rows;
}
