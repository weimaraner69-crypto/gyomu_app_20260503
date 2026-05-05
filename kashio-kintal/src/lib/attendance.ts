// 勤怠管理ユーティリティ — DB アクセス（サーバー専用）
// 型・純関数は @/lib/attendance-utils から直接 import してください。
// このファイルは supabase/server 依存を持つため、クライアントコンポーネントからの
// import はビルドエラーになります。再エクスポートは廃止済み。
import { createClient } from "@/lib/supabase/server";
import {
    type AttendancePunchRecord,
    buildDailyAttendanceRecords,
    buildMonthlyAttendanceDetailRows,
    buildMonthlyAttendanceSummary,
    type DailyAttendanceRecord,
    type MonthlyAttendanceDetailRow,
    type MonthlyAttendanceSummary,
    type MonthlyPunchRecord,
    type StoreOption,
    getDateUTCRange,
    getMonthUTCRange,
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

    // 参照日（dateStr）に所属していた従業員のみ取得（退職済み・将来所属は除外）
    const { data: empStores, error: empError } = await supabase
        .from("employee_stores")
        .select("employee_id, employees(id, name_kanji, name_kana)")
        .eq("store_id", storeId)
        .lte("valid_from", dateStr)
        .or(`valid_to.is.null,valid_to.gte.${dateStr}`);

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
 * employee_stores の有効レコード（valid_from <= today かつ valid_to IS NULL または valid_to >= today）の
 * 店舗のみ返す。将来所属・退職済みは含めない。
 * 担当店舗なしの場合は空配列を返す。
 */
export async function getManagerStores(employeeId: string): Promise<StoreOption[]> {
    const supabase = await createClient();
    const today = getTodayJST();
    const { data, error } = await supabase
        .from("employee_stores")
        .select("store_id, stores(id, name)")
        .eq("employee_id", employeeId)
        .lte("valid_from", today)
        .or(`valid_to.is.null,valid_to.gte.${today}`);

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

/**
 * 指定月に所属していた全従業員の一覧を取得する。
 * storeId 指定時はその店舗のみ対象。未指定時は全店舗を対象にする。
 * 月の範囲と employee_stores の valid_from/valid_to を照合する。
 */
export async function getStaffList(params: {
    yearMonth: string;
    storeId?: string;
    storeIds?: string[];
}): Promise<{ employeeId: string; employeeName: string }[]> {
    const { yearMonth, storeId, storeIds } = params;
    const supabase = await createClient();
    const { firstDay, lastDay } = getMonthUTCRange(yearMonth);

    let query = supabase
        .from("employee_stores")
        .select("employee_id, employees(id, name_kanji, name_kana)")
        .lte("valid_from", lastDay)
        .or(`valid_to.is.null,valid_to.gte.${firstDay}`);

    if (storeIds && storeIds.length > 0) {
        query = query.in("store_id", storeIds);
    } else if (storeId) {
        query = query.eq("store_id", storeId);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`従業員一覧取得エラー: ${error.message}`);
    }

    if (!data || data.length === 0) return [];

    // 重複排除（複数店舗兼務の場合）
    const seen = new Set<string>();
    const result: { employeeId: string; employeeName: string }[] = [];
    for (const row of data) {
        if (seen.has(row.employee_id)) continue;
        seen.add(row.employee_id);
        const emp = row.employees as {
            id: string;
            name_kanji: string | null;
            name_kana: string | null;
        } | null;
        result.push({
            employeeId: row.employee_id,
            employeeName: emp?.name_kanji ?? emp?.name_kana ?? "不明",
        });
    }
    return result.sort((a, b) =>
        a.employeeName.localeCompare(b.employeeName, "ja")
    );
}

/**
 * 指定従業員が対象月に所属している店舗ID一覧を返す。
 * managerStoreIds 指定時はその集合との共通部分のみ返す。
 */
export async function getEmployeeStoreIdsForMonth(params: {
    employeeId: string;
    yearMonth: string;
    managerStoreIds?: string[];
}): Promise<string[]> {
    const { employeeId, yearMonth, managerStoreIds } = params;
    const supabase = await createClient();
    const { firstDay, lastDay } = getMonthUTCRange(yearMonth);

    let query = supabase
        .from("employee_stores")
        .select("store_id")
        .eq("employee_id", employeeId)
        .lte("valid_from", lastDay)
        .or(`valid_to.is.null,valid_to.gte.${firstDay}`);

    if (managerStoreIds && managerStoreIds.length > 0) {
        query = query.in("store_id", managerStoreIds);
    }

    const { data, error } = await query;
    if (error) {
        throw new Error(`従業員所属店舗取得エラー: ${error.message}`);
    }

    return [...new Set((data ?? []).map((r) => r.store_id as string))];
}

/**
 * 月次集計・明細の共通入力データ（打刻 + 店舗）を取得する。
 */
async function getMonthlyAttendanceBase(params: {
    employeeId: string;
    yearMonth: string;
    allowedStoreIds?: string[];
}): Promise<{
    punches: MonthlyPunchRecord[];
    stores: StoreOption[];
    start: string;
    end: string;
}> {
    const { employeeId, yearMonth, allowedStoreIds } = params;
    const supabase = await createClient();
    const { start, end } = getMonthUTCRange(yearMonth);

    // 月全体の打刻を前後バッファ付きで取得（月またぎのペアに対応）
    const extendedStart = new Date(
        new Date(start).getTime() - 24 * 60 * 60 * 1000
    ).toISOString();
    const extendedEnd = new Date(
        new Date(end).getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    let punchQuery = supabase
        .from("punch_records")
        .select("employee_id, punch_type, punched_at, store_id")
        .eq("employee_id", employeeId)
        .gte("punched_at", extendedStart)
        .lt("punched_at", extendedEnd)
        .order("punched_at", { ascending: true });

    if (allowedStoreIds && allowedStoreIds.length > 0) {
        punchQuery = punchQuery.in("store_id", allowedStoreIds);
    }

    const { data: punches, error: punchError } = await punchQuery;

    if (punchError) {
        throw new Error(`打刻取得エラー: ${punchError.message}`);
    }

    const storeIds = [...new Set((punches ?? []).map((p) => p.store_id))];
    let stores: StoreOption[] = [];
    if (storeIds.length > 0) {
        const { data: storeData, error: storeError } = await supabase
            .from("stores")
            .select("id, name")
            .in("id", storeIds);

        if (storeError) {
            throw new Error(`店舗取得エラー: ${storeError.message}`);
        }
        stores = storeData ?? [];
    }

    return {
        punches: (punches ?? []) as MonthlyPunchRecord[],
        stores,
        start,
        end,
    };
}

/**
 * 指定従業員・月の月次勤怠サマリーを取得する。
 * allowedStoreIds 指定時は該当店舗のみを集計対象にする（manager 向け）。
 */
export async function getMonthlyAttendanceSummary(params: {
    employeeId: string;
    employeeName: string;
    yearMonth: string;
    allowedStoreIds?: string[];
}): Promise<MonthlyAttendanceSummary> {
    const { employeeId, employeeName, yearMonth, allowedStoreIds } = params;
    const base = await getMonthlyAttendanceBase({
        employeeId,
        yearMonth,
        allowedStoreIds,
    });

    return buildMonthlyAttendanceSummary({
        employeeId,
        employeeName,
        punches: base.punches,
        stores: base.stores,
        start: base.start,
        end: base.end,
    });
}

/**
 * 指定従業員・月の人別ビュー明細行を取得する。
 * allowedStoreIds 指定時は該当店舗のみ対象にする（manager 向け）。
 */
export async function getMonthlyAttendanceDetails(params: {
    employeeId: string;
    yearMonth: string;
    allowedStoreIds?: string[];
}): Promise<MonthlyAttendanceDetailRow[]> {
    const { employeeId, yearMonth, allowedStoreIds } = params;
    const base = await getMonthlyAttendanceBase({
        employeeId,
        yearMonth,
        allowedStoreIds,
    });

    return buildMonthlyAttendanceDetailRows({
        employeeId,
        punches: base.punches,
        stores: base.stores,
        start: base.start,
        end: base.end,
    });
}

/**
 * 指定従業員・月のサマリーと明細を一括取得する。
 * DBアクセスは1回分の打刻取得 + 1回分の店舗取得に集約する。
 */
export async function getMonthlyAttendanceViewData(params: {
    employeeId: string;
    employeeName: string;
    yearMonth: string;
    allowedStoreIds?: string[];
}): Promise<{
    summary: MonthlyAttendanceSummary;
    details: MonthlyAttendanceDetailRow[];
}> {
    const { employeeId, employeeName, yearMonth, allowedStoreIds } = params;
    const base = await getMonthlyAttendanceBase({
        employeeId,
        yearMonth,
        allowedStoreIds,
    });

    const summary = buildMonthlyAttendanceSummary({
        employeeId,
        employeeName,
        punches: base.punches,
        stores: base.stores,
        start: base.start,
        end: base.end,
    });

    const details = buildMonthlyAttendanceDetailRows({
        employeeId,
        punches: base.punches,
        stores: base.stores,
        start: base.start,
        end: base.end,
    });

    return { summary, details };
}
