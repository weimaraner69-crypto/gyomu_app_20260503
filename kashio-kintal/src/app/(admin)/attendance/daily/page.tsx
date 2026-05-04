// 勤怠管理（日別ビュー）— サーバーコンポーネント
import { requireRole } from "@/lib/auth";
import { getDailyAttendance, getAllStores, getManagerStores } from "@/lib/attendance";
import { getTodayJST } from "@/lib/attendance-utils";
import { DailyAttendanceClient } from "./DailyAttendanceClient";
import { redirect } from "next/navigation";

interface PageProps {
    searchParams: Promise<{ date?: string; storeId?: string }>;
}

export default async function DailyAttendancePage({
    searchParams,
}: PageProps) {
    const user = await requireRole(["owner", "manager", "sharoushi"]);
    // 社労士は閲覧のみ（docs/kashio_phase1_scope_v1.2.md 準拠）
    const canEdit = user.role !== "sharoushi";

    const params = await searchParams;
    // dateStr の形式検証：YYYY-MM-DD 以外、または実在しない日付は当日にフォールバック
    // 例: 2026-02-31 は正規表現を通るが実在しないため Date で再検証する
    const rawDate = params.date ?? "";
    const todayJST = getTodayJST();
    let dateStr = todayJST;
    let isValidDate = true;

    if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        const [y, m, d] = rawDate.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
            dateStr = rawDate;
            isValidDate = true;
        } else {
            isValidDate = false;
        }
    } else if (rawDate) {
        // 不正な形式
        isValidDate = false;
    }

    // 不正な dateStr が来た場合は redirect で正規化
    if (rawDate && !isValidDate) {
        const redirectParams = new URLSearchParams({ date: todayJST });
        if (params.storeId) {
            redirectParams.set("storeId", params.storeId);
        }
        redirect(`/admin/attendance/daily?${redirectParams.toString()}`);
    }

    // manager は担当店舗のみ。owner / sharoushi は全店舗
    const stores =
        user.role === "manager"
            ? await getManagerStores(user.employeeId)
            : await getAllStores();

    if (stores.length === 0) {
        return (
            <main className="p-6">
                <h1 className="text-2xl font-bold mb-4">勤怠管理（日別）</h1>
                <p className="text-gray-500">店舗が登録されていません。</p>
            </main>
        );
    }

    const storeId = params.storeId ?? stores[0].id;
    const selectedStore = stores.find((s) => s.id === storeId);

    if (!selectedStore) {
        const redirectParams = new URLSearchParams({
            date: dateStr,
            storeId: stores[0].id,
        });
        redirect(`/admin/attendance/daily?${redirectParams.toString()}`);
    }

    const records = await getDailyAttendance(storeId, dateStr);

    return (
        <DailyAttendanceClient
            records={records}
            stores={stores}
            selectedStoreId={storeId}
            dateStr={dateStr}
            canEdit={canEdit}
        />
    );
}
