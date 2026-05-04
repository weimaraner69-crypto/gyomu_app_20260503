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

    // 取得範囲を当日 JST 0:00 〜翌日 JST 07:00（UTC +7h）まで拡張し、
    // 日跨ぎ勤務（例: 21:00 出勤→翌 06:00 退勤）の clock_out も補足する
    const extendedEnd = new Date(
        new Date(end).getTime() + 7 * 60 * 60 * 1000
    ).toISOString();

    const { data: punches, error: punchError } = await supabase
        .from("punch_records")
        .select("employee_id, punch_type, punched_at")
        .eq("store_id", storeId)
        .in("employee_id", employeeIds)
        .gte("punched_at", start)
        .lt("punched_at", extendedEnd)
        .order("punched_at", { ascending: true });

    if (punchError) {
        throw new Error(`打刻取得エラー: ${punchError.message}`);
    }

    // 従業員ごとにペアリングされた clock_in/clock_out を集計。
    // 当日（start ～ end）内のすべての clock_in を抽出し、各々の clock_out をペアリング。
    interface PunchPair {
        clockIn: string;
        clockOut: string | null;
    }
    const punchPairsByEmployee = new Map<string, PunchPair[]>();

    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();

    // 当日範囲内の clock_in をすべて抽出
    for (const p of punches ?? []) {
        const pMs = new Date(p.punched_at).getTime();
        if (p.punch_type === "clock_in" && pMs >= startMs && pMs < endMs) {
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
        const pairs = punchPairsByEmployee.get(es.employee_id) ?? [];

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
                    if (pair.clockOut) {
                        const diffMs =
                            new Date(pair.clockOut).getTime() -
                            new Date(pair.clockIn).getTime();
                        totalWorkMs += diffMs;
                        totalNightMinutes += calcNightMinutes(
                            pair.clockIn,
                            pair.clockOut
                        );
                    } else if (dateStr === todayJST) {
                        // 当日未退勤の場合のみ現在時刻まで概算
                        const diffMs =
                            Date.now() - new Date(pair.clockIn).getTime();
                        totalWorkMs += diffMs;
                        totalNightMinutes += calcNightMinutes(
                            pair.clockIn,
                            null
                        );
                    }
                }
                workMinutes = Math.max(0, Math.floor(totalWorkMs / 60000));
                nightMinutes = totalNightMinutes;
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
