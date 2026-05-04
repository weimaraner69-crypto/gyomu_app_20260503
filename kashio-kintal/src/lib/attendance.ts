// 勤怠管理ユーティリティ — DB アクセス（サーバー専用）
// 型・純関数は @/lib/attendance-utils から直接 import してください。
// このファイルは supabase/server 依存を持つため、クライアントコンポーネントからの
// import はビルドエラーになります。再エクスポートは廃止済み。
import { createClient } from "@/lib/supabase/server";
import {
    type AttendancePunchRecord,
    buildDailyAttendanceRecords,
    type DailyAttendanceRecord,
    type StoreOption,
    getDateUTCRange,
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

    // 当日範囲と重なる打刻を取りこぼしにくくするため、検索期間は前後24時間拡張する
    const startDate = new Date(start);
    const extendedStart = new Date(
        startDate.getTime() - 24 * 60 * 60 * 1000
    ).toISOString();
    const endDate = new Date(end);
    const extendedEnd = new Date(
        endDate.getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

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

    const employees = empStores.map((es) => {
        const emp = es.employees as {
            id: string;
            name_kanji: string | null;
            name_kana: string | null;
        } | null;
        return {
            employeeId: es.employee_id,
            employeeName: emp?.name_kanji ?? emp?.name_kana ?? "不明",
        };
    });

    return buildDailyAttendanceRecords({
        employees,
        punches: (punches ?? []) as AttendancePunchRecord[],
        start,
        end,
        dateStr,
    });
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

/**
 * manager ロールのユーザーが担当する店舗一覧を取得する。
 * employee_stores の有効レコード（valid_to IS NULL）から store_id を取得し、
 * stores テーブルと結合して返す。
 * 担当店舗なしの場合は空配列を返す。
 */
export async function getManagerStores(employeeId: string): Promise<StoreOption[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("employee_stores")
        .select("store_id, stores(id, name)")
        .eq("employee_id", employeeId)
        .is("valid_to", null);

    if (error) {
        throw new Error(`担当店舗取得エラー: ${error.message}`);
    }

    if (!data || data.length === 0) return [];

    return data
        .map((row) => {
            const store = row.stores as { id: string; name: string } | null;
            return store ? { id: store.id, name: store.name } : null;
        })
        .filter((s): s is StoreOption => s !== null);
}
