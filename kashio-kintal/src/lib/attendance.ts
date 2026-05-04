// 勤怠管理ユーティリティ — DB アクセス（サーバー専用）
// 型・純関数は @/lib/attendance-utils から直接 import してください。
// このファイルは supabase/server 依存を持つため、クライアントコンポーネントからの
// import はビルドエラーになります。再エクスポートは廃止済み。
import { createClient } from "@/lib/supabase/server";
import {
    type DailyAttendanceRecord,
    type StoreOption,
    getDateUTCRange,
    calcNightMinutes,
    getTodayJST,
} from "@/lib/attendance-utils";

/**
 * 特定日・特定店舗の全スタッフ勤怠を取得する。
 * dateStr は JST の日付文字列（YYYY-MM-DD）。
 * 未退勤（working）→ 先頭、打刻なし → 中間、退勤済み → 末尾の順で返す。
 */
export async function getDailyAttendance(
    storeId: string,
    dateStr: string
): Promise<DailyAttendanceRecord[]> {
    const supabase = await createClient();
    const { start, end } = getDateUTCRange(dateStr);

    // 店舗に所属する従業員を取得
    const { data: empStores, error: empError } = await supabase
        .from("employee_stores")
        .select("employee_id, employees(id, name_kanji, name_kana)")
        .eq("store_id", storeId);

    if (empError) {
        throw new Error(`従業員取得エラー: ${empError.message}`);
    }

    if (!empStores || empStores.length === 0) return [];

    const employeeIds = empStores.map((es) => es.employee_id);

    // 取得範囲を前日 JST 19:00 ～翌日 JST 07:00 に拡張して、
    // 日跨ぎ勤務（例: 前日 21:00 出勤→当日 06:00 退勤）の全パターンに対応する
    const startDate = new Date(start);
    const extendedStart = new Date(
        startDate.getTime() - 5 * 60 * 60 * 1000
    ).toISOString(); // 前日 19:00
    const endDate = new Date(end);
    const extendedEnd = new Date(
        endDate.getTime() + 7 * 60 * 60 * 1000
    ).toISOString(); // 翌日 07:00

    const { data: punches, error: punchError } = await supabase
        .from("punch_records")
        .select("employee_id, punch_type, punched_at")
        .eq("store_id", storeId)
        .in("employee_id", employeeIds)
        .gte("punched_at", extendedStart)
        .lt("punched_at", extendedEnd)
        .order("punched_at", { ascending: true });

    if (punchError) {
        throw new Error(`打刻取得エラー: ${punchError.message}`);
    }

    // 従業員ごとにペアリングされた clock_in/clock_out を集計。
    // 前日 19:00 ～当日 24:00 内のすべての clock_in を抽出し、各々の clock_out をペアリング。
    interface PunchPair {
        clockIn: string;
        clockOut: string | null;
    }
    const punchPairsByEmployee = new Map<string, PunchPair[]>();

    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const extendedStartMs = new Date(extendedStart).getTime();

    // 前日 19:00 ～当日 24:00 の範囲内で clock_in をすべて抽出
    for (const p of punches ?? []) {
        const pMs = new Date(p.punched_at).getTime();
        if (p.punch_type === "clock_in" && pMs >= extendedStartMs && pMs < endMs) {
            const pairs = punchPairsByEmployee.get(p.employee_id) ?? [];
            pairs.push({ clockIn: p.punched_at, clockOut: null });
            punchPairsByEmployee.set(p.employee_id, pairs);
        }
    }

    // 各 clock_in に対応する clock_out をペアリング
    // clock_out が clock_in より後の時刻であることを条件にする（前日退勤など誤ペアを回避）
    for (const p of punches ?? []) {
        if (p.punch_type === "clock_out") {
            const pairs = punchPairsByEmployee.get(p.employee_id);
            if (pairs && pairs.length > 0) {
                const pOutMs = new Date(p.punched_at).getTime();
                // 未ペアで、clock_out >= clock_in を満たす最初の clock_in を探す
                for (const pair of pairs) {
                    if (pair.clockOut === null) {
                        const pInMs = new Date(pair.clockIn).getTime();
                        if (pOutMs >= pInMs) {
                            pair.clockOut = p.punched_at;
                            break;
                        }
                    }
                }
            }
        }
    }

    const todayJST = getTodayJST();

    const records: DailyAttendanceRecord[] = empStores.map((es) => {
        const emp = es.employees as {
            id: string;
            name_kanji: string | null;
            name_kana: string | null;
        } | null;
        const allPairs = punchPairsByEmployee.get(es.employee_id) ?? [];
        // 当日範囲 [start, end) と重なるペアを対象にする
        // （前日出勤→当日退勤のような日跨ぎ勤務も含める）
        const pairs = allPairs.filter((p) => {
            const pInMs = new Date(p.clockIn).getTime();
            const pOutMs = p.clockOut ? new Date(p.clockOut).getTime() : null;
            return pInMs < endMs && (pOutMs === null || pOutMs >= startMs);
        });

        let workMinutes: number | null = null;
        let nightMinutes: number | null = null;
        let status: DailyAttendanceRecord["status"] = "no_punch";

        if (pairs.length > 0) {
            // 最初のペアの clock_in が「当日出勤」判定
            const firstIn = pairs[0]?.clockIn;
            const hasUnpaired = pairs.some((p) => p.clockOut === null);

            if (firstIn) {
                if (hasUnpaired) {
                    status = "working";
                } else {
                    status = "completed";
                }

                // すべてのペアの時間と深夜分を合算
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
                        // 当日未退勤の場合のみ現在時刻までの概算（当日範囲でクリップ）
                        const overlapStartMs = Math.max(pInMs, startMs);
                        const overlapEndMs = Math.min(Date.now(), endMs);
                        if (overlapEndMs > overlapStartMs) {
                            totalWorkMs += overlapEndMs - overlapStartMs;
                            totalNightMinutes += calcNightMinutes(
                                new Date(overlapStartMs).toISOString(),
                                new Date(overlapEndMs).toISOString()
                            );
                        }
                    }
                }

                // 過去日の未退勤は workMinutes/nightMinutes を null にする
                // （0分扱いになって誤解を招くのを避ける）
                if (hasUnpaired && dateStr !== todayJST) {
                    workMinutes = null;
                    nightMinutes = null;
                } else {
                    workMinutes = Math.max(0, Math.floor(totalWorkMs / 60000));
                    nightMinutes = totalNightMinutes;
                }
            }
        }

        return {
            employeeId: es.employee_id,
            employeeName: emp?.name_kanji ?? emp?.name_kana ?? "不明",
            clockIn: pairs[0]?.clockIn ?? null,
            clockOut: pairs[pairs.length - 1]?.clockOut ?? null,
            workMinutes,
            nightMinutes,
            status,
        };
    });

    // ソート: 未退勤（working）→ 先頭、打刻なし → 中間、退勤済み → 末尾
    const order: Record<DailyAttendanceRecord["status"], number> = {
        working: 0,
        no_punch: 1,
        completed: 2,
    };
    return records.sort((a, b) => order[a.status] - order[b.status]);
}

/** 全店舗一覧を取得する */
export async function getAllStores(): Promise<StoreOption[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .order("name");

    if (error) {
        throw new Error(`店舗取得エラー: ${error.message}`);
    }

    return data ?? [];
}
