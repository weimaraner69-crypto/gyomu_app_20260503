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
 * JST の日付文字列（YYYY-MM-DD）から当日の UTC 範囲を返す。
 * JST 0:00〜翌 0:00 を UTC に変換する。
 */
export function getDateUTCRange(dateStr: string): { start: string; end: string } {
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const [year, month, day] = dateStr.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, day) - jstOffsetMs).toISOString();
    const end = new Date(Date.UTC(year, month - 1, day + 1) - jstOffsetMs).toISOString();
    return { start, end };
}

/** 今日の JST 日付を YYYY-MM-DD 形式で返す */
export function getTodayJST(): string {
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const now = new Date(Date.now() + jstOffsetMs);
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
 */
export function buildDailyAttendanceRecords(params: {
    employees: AttendanceEmployee[];
    punches: AttendancePunchRecord[];
    start: string;
    end: string;
    dateStr: string;
    todayJST?: string;
    nowMs?: number;
    lookbackHours?: number;
}): DailyAttendanceRecord[] {
    const {
        employees,
        punches,
        start,
        end,
        dateStr,
        todayJST = getTodayJST(),
        nowMs = Date.now(),
        lookbackHours = 24,
    } = params;

    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const lookbackMs = lookbackHours * 60 * 60 * 1000;

    const punchPairsByEmployee = new Map<string, PunchPair[]>();

    // 前日以前から当日へ跨る勤務を拾うため、一定時間の lookback を許容する
    for (const p of punches) {
        const pMs = new Date(p.punched_at).getTime();
        if (p.punch_type === "clock_in" && pMs >= startMs - lookbackMs && pMs < endMs) {
            const pairs = punchPairsByEmployee.get(p.employee_id) ?? [];
            pairs.push({ clockIn: p.punched_at, clockOut: null });
            punchPairsByEmployee.set(p.employee_id, pairs);
        }
    }

    for (const p of punches) {
        if (p.punch_type !== "clock_out") continue;
        const pairs = punchPairsByEmployee.get(p.employee_id);
        if (!pairs || pairs.length === 0) continue;

        const pOutMs = new Date(p.punched_at).getTime();
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
        const allPairs = punchPairsByEmployee.get(employee.employeeId) ?? [];
        const pairs = allPairs.filter((p) => {
            const pInMs = new Date(p.clockIn).getTime();
            const pOutMs = p.clockOut ? new Date(p.clockOut).getTime() : null;
            return pInMs < endMs && (pOutMs === null || pOutMs >= startMs);
        });

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
                    const overlapStartMs = Math.max(pInMs, startMs);
                    const overlapEndMs = Math.min(pOutMs, endMs);
                    if (overlapEndMs > overlapStartMs) {
                        totalWorkMs += overlapEndMs - overlapStartMs;
                        totalNightMinutes += calcNightMinutes(
                            new Date(overlapStartMs).toISOString(),
                            new Date(overlapEndMs).toISOString()
                        );
                    }
                } else if (dateStr === todayJST) {
                    const overlapStartMs = Math.max(pInMs, startMs);
                    const overlapEndMs = Math.min(nowMs, endMs);
                    if (overlapEndMs > overlapStartMs) {
                        totalWorkMs += overlapEndMs - overlapStartMs;
                        totalNightMinutes += calcNightMinutes(
                            new Date(overlapStartMs).toISOString(),
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
