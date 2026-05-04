"use server";
// iPad 打刻サーバーアクション
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getNextPunchType } from "@/lib/punch";

export interface IpadPunchResult {
    success: boolean;
    punchType?: "clock_in" | "clock_out";
    punchedAt?: string;
    error?: string;
}

/**
 * iPad 打刻アクション。
 * 管理者が操作するが、punch_records の employee_id は選択したスタッフの ID を使用する。
 * 打刻時刻はサーバー側で生成する（端末時刻不使用）。
 */
export async function executeIpadPunch(
    storeId: string,
    employeeId: string
): Promise<IpadPunchResult> {
    const user = await getCurrentUser();
    if (!user) {
        return { success: false, error: "認証が必要です" };
    }
    if (user.role !== "owner" && user.role !== "manager") {
        return { success: false, error: "権限がありません" };
    }

    const supabase = await createClient();

    // 最新打刻を取得して打刻種別を決定
    const { data: latest } = await supabase
        .from("punch_records")
        .select("id, punch_type, punched_at, store_id")
        .eq("employee_id", employeeId)
        .eq("store_id", storeId)
        .order("punched_at", { ascending: false })
        .limit(1)
        .single();

    const punchType = getNextPunchType(
        latest
            ? {
                id: latest.id,
                punch_type: latest.punch_type as "clock_in" | "clock_out",
                punched_at: latest.punched_at,
                store_id: latest.store_id,
            }
            : null
    );
    const punchedAt = new Date().toISOString();

    const { error } = await supabase.from("punch_records").insert({
        employee_id: employeeId,
        store_id: storeId,
        punch_type: punchType,
        punched_at: punchedAt,
        device_type: "ipad",
    });

    if (error) {
        return { success: false, error: "打刻に失敗しました" };
    }

    return { success: true, punchType, punchedAt };
}
