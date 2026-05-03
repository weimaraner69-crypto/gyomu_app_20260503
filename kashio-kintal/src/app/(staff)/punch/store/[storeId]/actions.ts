"use server";

// 打刻サーバーアクション — punch_records への INSERT + attendance_records 更新
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getNextPunchType, getLatestPunch, getStoreById } from "@/lib/punch";

export interface PunchState {
    error?: string;
}

/**
 * 打刻を実行するサーバーアクション。
 * GPS 情報はオプション（取得失敗しても打刻は記録する）。
 */
export async function executePunch(
    storeId: string,
    _prevState: PunchState,
    formData: FormData
): Promise<PunchState> {
    const user = await getCurrentUser();
    if (!user) {
        redirect("/login");
    }

    const store = await getStoreById(storeId);
    if (!store) {
        return { error: "店舗が見つかりません。URLを確認してください。" };
    }

    const supabase = await createClient();

    // employeeId を users テーブルから取得
    const employeeId = user.employeeId;
    if (!employeeId) {
        return { error: "従業員情報が登録されていません。管理者に連絡してください。" };
    }

    // 次の打刻種別を決定
    const latest = await getLatestPunch(employeeId, storeId);
    const punchType = getNextPunchType(latest);

    // GPS 情報（任意）
    const gpsLat = formData.get("gps_lat");
    const gpsLng = formData.get("gps_lng");
    const lat =
        gpsLat && gpsLat !== "" ? parseFloat(gpsLat.toString()) : null;
    const lng =
        gpsLng && gpsLng !== "" ? parseFloat(gpsLng.toString()) : null;

    // サーバー時刻で打刻を記録（端末時刻に依存しない）
    const now = new Date().toISOString();

    const { error: insertError } = await supabase.from("punch_records").insert({
        employee_id: employeeId,
        store_id: storeId,
        punch_type: punchType,
        punched_at: now,
        server_recorded_at: now,
        gps_lat: lat,
        gps_lng: lng,
        device_type: "smartphone",
    });

    if (insertError) {
        console.error("punch_records insert error:", insertError);
        return { error: "打刻の記録に失敗しました。もう一度お試しください。" };
    }

    // 完了ページへリダイレクト
    redirect(
        `/punch/store/${storeId}/done?type=${punchType}&at=${encodeURIComponent(now)}&store=${encodeURIComponent(store.name)}`
    );
}
