// 打刻完了ページ — 打刻種別・時刻・店舗名を表示してOKで閉じる
import { redirect } from "next/navigation";
import { punchTypeLabel } from "@/lib/punch";
import CloseButton from "./CloseButton";

interface Props {
    searchParams: Promise<{ type?: string; at?: string; store?: string }>;
}

export default async function PunchDonePage({ searchParams }: Props) {
    const { type, at, store } = await searchParams;

    if (!type || !at || !store) {
        redirect("/dashboard");
    }

    // type が許可リスト以外の場合はリダイレクト
    if (type !== "clock_in" && type !== "clock_out") {
        redirect("/dashboard");
    }

    // punchTypeLabel は punch.ts の関数で一元管理
    const label = punchTypeLabel(type as "clock_in" | "clock_out");
    const punchTime = new Date(at);
    // at が不正な値（Invalid Date）の場合はダッシュボードにリダイレクト
    if (isNaN(punchTime.getTime())) {
        redirect("/dashboard");
    }
    const timeStr = punchTime.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });

    const bgColor = type === "clock_in" ? "bg-blue-600" : "bg-orange-500";

    return (
        <div className="min-h-dvh flex flex-col items-center justify-center bg-white px-5 py-10">
            <div className="w-full max-w-sm text-center">
                {/* 完了アイコン */}
                <div
                    className={`w-20 h-20 rounded-full ${bgColor} flex items-center justify-center mx-auto mb-6`}
                >
                    <svg
                        className="w-10 h-10 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    打刻しました
                </h1>

                <div className="mt-6 rounded-xl bg-gray-50 border border-gray-200 px-5 py-5 text-left space-y-3">
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-500">種別</span>
                        <span className="text-sm font-semibold text-gray-900">
                            {label}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-500">時刻</span>
                        <span className="text-sm font-semibold text-gray-900">{timeStr}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-500">店舗</span>
                        <span className="text-sm font-semibold text-gray-900">{decodeURIComponent(store)}</span>
                    </div>
                </div>

                <CloseButton />
                <p className="mt-2 text-xs text-gray-400">
                    ※ このページを閉じてください
                </p>
            </div>
        </div>
    );
}
