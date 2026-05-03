// 管理者向け QRコード生成・印刷ページ
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import QrDisplay from "./QrDisplay";

export default async function QrPage() {
    await requireRole(["owner", "manager"]);

    const supabase = await createClient();
    const { data: stores } = await supabase
        .from("stores")
        .select("id, name")
        .order("name");

    const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://kashio-kintal.vercel.app";

    return (
        <div className="min-h-screen bg-gray-50 px-6 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">QRコード管理</h1>
            <p className="text-sm text-gray-500 mb-8">
                各店舗のQRコードを印刷して掲示してください。
                スタッフはスマホで読み取って打刻します。
            </p>

            {!stores || stores.length === 0 ? (
                <p className="text-gray-500">店舗が登録されていません。</p>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {stores.map((store) => (
                        <QrDisplay
                            key={store.id}
                            storeName={store.name}
                            url={`${appUrl}/punch/store/${store.id}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
