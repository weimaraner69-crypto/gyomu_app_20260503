// 打刻ページ — QRコード読み取り後のスマホ打刻画面
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getStoreById, getLatestPunch, getNextPunchType } from "@/lib/punch";
import { createClient } from "@/lib/supabase/server";
import PunchForm from "./PunchForm";
import { executePunch } from "./actions";

interface Props {
    params: Promise<{ storeId: string }>;
}

export default async function PunchPage({ params }: Props) {
    const { storeId } = await params;
    const user = await requireAuth();

    const [store, employeeData] = await Promise.all([
        getStoreById(storeId),
        (async () => {
            const supabase = await createClient();
            const { data } = await supabase
                .from("employees")
                .select("id, name_kanji")
                .eq("id", user.employeeId)
                .single();
            return data;
        })(),
    ]);

    if (!store) notFound();

    const latest = await getLatestPunch(user.employeeId, storeId);
    const nextPunchType = getNextPunchType(latest);

    // executePunch に storeId を bind したアクション
    const boundAction = executePunch.bind(null, storeId);

    return (
        <div className="min-h-dvh bg-white flex flex-col items-center justify-center px-5 py-10">
            <div className="w-full max-w-sm">
                <h1 className="text-center text-2xl font-bold text-gray-900 mb-8">
                    打刻
                </h1>

                <PunchForm
                    nextPunchType={nextPunchType}
                    storeName={store.name}
                    employeeName={employeeData?.name_kanji ?? user.email}
                    action={boundAction}
                />

                <div className="mt-8 text-center">
                    <a
                        href="/history"
                        className="text-sm text-blue-600 hover:underline"
                    >
                        打刻履歴を確認する
                    </a>
                </div>
            </div>
        </div>
    );
}
