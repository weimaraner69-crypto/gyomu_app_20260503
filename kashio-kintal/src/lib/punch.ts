// 打刻ユーティリティ — punch_records への挿入・直近打刻取得（サーバー専用）
// 純関数・型は @/lib/punch-utils からも import できます（クライアント側はそちらを使用）。
import { createClient } from "@/lib/supabase/server";
export type { PunchType, EmployeeWithTodayStatus } from "@/lib/punch-utils";
export { punchTypeLabel, formatWorkMinutes } from "@/lib/punch-utils";
import type { PunchType, EmployeeWithTodayStatus } from "@/lib/punch-utils";

export interface PunchRecord {
    id: string;
    punch_type: PunchType;
    punched_at: string;
    store_id: string;
}

export interface StoreInfo {
    id: string;
    name: string;
}

/** 店舗情報を取得する */
export async function getStoreById(storeId: string): Promise<StoreInfo | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("stores")
        .select("id, name")
        .eq("id", storeId)
        .single();
    return data;
}

/** 従業員の当該店舗での最新打刻を取得する */
export async function getLatestPunch(
    employeeId: string,
    storeId: string
): Promise<PunchRecord | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("punch_records")
        .select("id, punch_type, punched_at, store_id")
        .eq("employee_id", employeeId)
        .eq("store_id", storeId)
        .order("punched_at", { ascending: false })
        .limit(1)
        .single();
    return data;
}

/**
 * 次に行うべき打刻種別を判定する。
 * 最新打刻が clock_in → clock_out。それ以外（未打刻・clock_out済み）→ clock_in。
 */
export function getNextPunchType(latest: PunchRecord | null): PunchType {
    if (latest?.punch_type === "clock_in") return "clock_out";
    return "clock_in";
}

/**
 * 従業員の打刻履歴を月単位で取得する。
 * year, month は 1-based（例: 2026年5月 → year=2026, month=5）。
 */
export async function getPunchHistory(
    employeeId: string,
    year: number,
    month: number
) {
    const supabase = await createClient();

    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const end = new Date(Date.UTC(year, month, 1)).toISOString();

    const { data } = await supabase
        .from("punch_records")
        .select("id, punch_type, punched_at, store_id, stores(name)")
        .eq("employee_id", employeeId)
        .gte("punched_at", start)
        .lt("punched_at", end)
        .order("punched_at", { ascending: true });

    return data ?? [];
}

/**
 * 月次の勤務時間合計（分）を計算する。
 * clock_in と clock_out のペアを日付ごとにマッチングして算出する。
 */
export function calcMonthlyMinutes(
    records: { punch_type: string; punched_at: string; store_id: string }[]
): number {
    // store_id ごとにグループ化してペアリング
    const byStore = new Map<string, typeof records>();
    for (const r of records) {
        const group = byStore.get(r.store_id) ?? [];
        group.push(r);
        byStore.set(r.store_id, group);
    }

    let totalMinutes = 0;
    for (const group of byStore.values()) {
        let pendingIn: Date | null = null;
        for (const r of group) {
            if (r.punch_type === "clock_in") {
                pendingIn = new Date(r.punched_at);
            } else if (r.punch_type === "clock_out" && pendingIn) {
                const diff = new Date(r.punched_at).getTime() - pendingIn.getTime();
                totalMinutes += Math.floor(diff / 60000);
                pendingIn = null;
            }
        }
    }
    return totalMinutes;
}

/**
 * 当日（JST）の日付範囲を UTC ISO 文字列で返す。
 * JST 0:00〜23:59 を UTC に変換する。
 */
export function getTodayUTCRange(): { start: string; end: string } {
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const now = new Date();
    const jstNow = new Date(now.getTime() + jstOffsetMs);
    const year = jstNow.getUTCFullYear();
    const month = jstNow.getUTCMonth();
    const day = jstNow.getUTCDate();
    const start = new Date(Date.UTC(year, month, day) - jstOffsetMs).toISOString();
    const end = new Date(Date.UTC(year, month, day + 1) - jstOffsetMs).toISOString();
    return { start, end };
}

/**
 * 特定店舗の全スタッフと当日打刻状況を取得する。
 * 未退勤（clock_in のみ）→ 先頭、打刻なし → 中間、退勤済み → 末尾 の順で返す。
 */
export async function getStoreEmployeesWithTodayStatus(
    storeId: string
): Promise<EmployeeWithTodayStatus[]> {
    const supabase = await createClient();
    const { start, end } = getTodayUTCRange();

    // 店舗に所属する従業員を取得
    const { data: empStores } = await supabase
        .from("employee_stores")
        .select("employee_id, employees(id, name_kanji, name_kana)")
        .eq("store_id", storeId);

    if (!empStores || empStores.length === 0) return [];

    const employeeIds = empStores.map((es) => es.employee_id);

    // 当日の打刻記録を取得（降順なので先頭が最新）
    const { data: punches } = await supabase
        .from("punch_records")
        .select("employee_id, punch_type, punched_at")
        .eq("store_id", storeId)
        .in("employee_id", employeeIds)
        .gte("punched_at", start)
        .lt("punched_at", end)
        .order("punched_at", { ascending: false });

    // 各従業員の最新打刻を集約
    const latestByEmployee = new Map<
        string,
        { punch_type: string; punched_at: string }
    >();
    for (const p of punches ?? []) {
        if (!latestByEmployee.has(p.employee_id)) {
            latestByEmployee.set(p.employee_id, p);
        }
    }

    const employees: EmployeeWithTodayStatus[] = empStores.map((es) => {
        const emp = es.employees as {
            id: string;
            name_kanji: string | null;
            name_kana: string | null;
        } | null;
        const latest = latestByEmployee.get(es.employee_id) ?? null;
        return {
            id: es.employee_id,
            name: emp?.name_kanji ?? emp?.name_kana ?? "不明",
            latestTodayPunchType: (latest?.punch_type ?? null) as PunchType | null,
            latestTodayPunchedAt: latest?.punched_at ?? null,
        };
    });

    // 未退勤 → 先頭、打刻なし → 中間、退勤済み → 末尾
    return employees.sort((a, b) => {
        const order = (e: EmployeeWithTodayStatus) => {
            if (e.latestTodayPunchType === "clock_in") return 0;
            if (e.latestTodayPunchType === null) return 1;
            return 2;
        };
        return order(a) - order(b);
    });
}
