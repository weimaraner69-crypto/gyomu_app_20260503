// 勤怠管理ユーティリティ — DB アクセス（サーバー専用）
// 純関数・型は attendance-utils.ts に分離済み
import { createClient } from "@/lib/supabase/server";
import {
    type DailyAttendanceRecord,
    type StoreOption,
    getDateUTCRange,
    calcNightMinutes,
} from "@/lib/attendance-utils";

// 型・純関数を再エクスポートし、既存の import を壊さない
export type { DailyAttendanceRecord, StoreOption };
export {
    getDateUTCRange,
    calcNightMinutes,
} from "@/lib/attendance-utils";
export { getTodayJST, getAdjacentDate } from "@/lib/attendance-utils";

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
    const { data: empStores } = await supabase
        .from("employee_stores")
        .select("employee_id, employees(id, name)")
        .eq("store_id", storeId);

    if (!empStores || empStores.length === 0) return [];

    const employeeIds = empStores.map((es) => es.employee_id);

    // 取得範囲を当日 JST 0:00 〜翌日 JST 07:00（UTC +7h）まで拡張し、
    // 日跨ぎ勤務（例: 21:00 出勤→翌 06:00 退勤）の clock_out も補足する
    const extendedEnd = new Date(
        new Date(end).getTime() + 7 * 60 * 60 * 1000
    ).toISOString();

    const { data: punches } = await supabase
        .from("punch_records")
        .select("employee_id, punch_type, punched_at")
        .eq("store_id", storeId)
        .in("employee_id", employeeIds)
        .gte("punched_at", start)
        .lt("punched_at", extendedEnd)
        .order("punched_at", { ascending: true });

    // 各従業員の最初の clock_in と最後の clock_out を集計。
    // clock_in は当日範囲（start 〜 end）内のもののみを「当日の出勤」として扱う。
    // clock_out は拡張範囲内（翌日 JST 05:00 まで）を対象とする。
    const clockInByEmployee = new Map<string, string>();
    const clockOutByEmployee = new Map<string, string>();

    for (const p of punches ?? []) {
        if (
            p.punch_type === "clock_in" &&
            p.punched_at >= start &&
            p.punched_at < end &&
            !clockInByEmployee.has(p.employee_id)
        ) {
            clockInByEmployee.set(p.employee_id, p.punched_at);
        }
        if (
            p.punch_type === "clock_out" &&
            clockInByEmployee.has(p.employee_id)
        ) {
            // 当日の出勤に対応する最後の clock_out を保持（上書き）
            clockOutByEmployee.set(p.employee_id, p.punched_at);
        }
    }

    const records: DailyAttendanceRecord[] = empStores.map((es) => {
        const emp = es.employees as { id: string; name: string } | null;
        const clockIn = clockInByEmployee.get(es.employee_id) ?? null;
        const clockOut = clockOutByEmployee.get(es.employee_id) ?? null;

        let workMinutes: number | null = null;
        let nightMinutes: number | null = null;
        let status: DailyAttendanceRecord["status"] = "no_punch";

        if (clockIn) {
            if (clockOut) {
                const diffMs =
                    new Date(clockOut).getTime() - new Date(clockIn).getTime();
                workMinutes = Math.max(0, Math.floor(diffMs / 60000));
                nightMinutes = calcNightMinutes(clockIn, clockOut);
                status = "completed";
            } else {
                status = "working";
                // 勤務中は現在時刻までの深夜時間を概算
                nightMinutes = calcNightMinutes(clockIn, null);
            }
        }

        return {
            employeeId: es.employee_id,
            employeeName: emp?.name ?? "不明",
            clockIn,
            clockOut,
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
    const { data } = await supabase
        .from("stores")
        .select("id, name")
        .order("name");
    return data ?? [];
}
