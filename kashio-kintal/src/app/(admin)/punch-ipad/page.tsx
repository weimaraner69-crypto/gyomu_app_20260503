// iPad 打刻ページ（管理者向け）
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStoreEmployeesWithTodayStatus } from "@/lib/punch";
import IpadPunchClient from "./IpadPunchClient";

interface Props {
    searchParams: Promise<{ storeId?: string }>;
}

export default async function IpadPunchPage({ searchParams }: Props) {
    const user = await requireRole(["owner", "manager"]);
    const { storeId } = await searchParams;

    const supabase = await createClient();

    // 全店舗を取得
    const { data: stores } = await supabase
        .from("stores")
        .select("id, name")
        .order("name");

    if (!stores || stores.length === 0) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                    iPad 打刻
                </h1>
                <p className="text-gray-500">店舗が登録されていません。</p>
            </div>
        );
    }

    const selectedStoreId = storeId ?? stores[0].id;
    const employees = await getStoreEmployeesWithTodayStatus(selectedStoreId);

    return (
        <div className="min-h-screen bg-gray-50 px-6 py-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">
                        iPad 打刻
                    </h1>
                    <span className="text-sm text-gray-400">
                        管理者: {user.email}
                    </span>
                </div>
                <IpadPunchClient
                    stores={stores}
                    initialStoreId={selectedStoreId}
                    initialEmployees={employees}
                />
            </div>
        </div>
    );
}
