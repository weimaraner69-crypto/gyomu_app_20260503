// 打刻履歴ページ — 当月の勤務時間合計と月別打刻一覧（12ヶ月分）
import { requireAuth } from "@/lib/auth";
import {
    getPunchHistory,
    calcMonthlyMinutes,
    formatWorkMinutes,
    punchTypeLabel,
} from "@/lib/punch";
import Link from "next/link";

interface Props {
    searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function HistoryPage({ searchParams }: Props) {
    const user = await requireAuth();
    const sp = await searchParams;

    const now = new Date();
    const year = sp.year ? parseInt(sp.year, 10) : now.getFullYear();
    const month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1;

    const records = await getPunchHistory(user.employeeId, year, month);
    const totalMinutes = calcMonthlyMinutes(records);

    // 月切り替え用リンク生成（12ヶ月分）
    const months: { label: string; year: number; month: number }[] = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
            year: d.getFullYear(),
            month: d.getMonth() + 1,
        });
    }

    const currentLabel = `${year}年${month}月`;

    return (
        <div className="min-h-dvh bg-gray-50">
            {/* ヘッダー */}
            <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3">
                <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                    ←
                </Link>
                <h1 className="text-lg font-semibold text-gray-900">打刻履歴</h1>
            </header>

            <main className="px-5 py-6 max-w-lg mx-auto">
                {/* 月選択 */}
                <div className="mb-4">
                    <label htmlFor="month-select" className="sr-only">
                        月を選択
                    </label>
                    <select
                        id="month-select"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        defaultValue={`${year}-${month}`}
                        onChange={undefined}
                    >
                        {months.map((m) => (
                            <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                                {m.label}
                            </option>
                        ))}
                    </select>
                    {/* JS 無効時のフォールバック: リンク一覧 */}
                    <div className="flex gap-2 mt-2 flex-wrap">
                        {months.map((m) => (
                            <Link
                                key={`${m.year}-${m.month}`}
                                href={`/history?year=${m.year}&month=${m.month}`}
                                className={`text-xs px-2 py-1 rounded-full border ${m.year === year && m.month === month
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
                                    }`}
                            >
                                {m.label}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* 月次合計 */}
                <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-5 py-4 flex items-center justify-between">
                    <span className="text-sm text-blue-700 font-medium">
                        {currentLabel} 合計勤務時間
                    </span>
                    <span className="text-xl font-bold text-blue-800">
                        {totalMinutes > 0 ? formatWorkMinutes(totalMinutes) : "0分"}
                    </span>
                </div>

                {/* 打刻一覧 */}
                {records.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">
                        {currentLabel}の打刻記録はありません
                    </div>
                ) : (
                    <div className="space-y-2">
                        {records.map((r) => {
                            const punchedAt = new Date(r.punched_at);
                            const dateStr = punchedAt.toLocaleDateString("ja-JP", {
                                timeZone: "Asia/Tokyo",
                                month: "2-digit",
                                day: "2-digit",
                                weekday: "short",
                            });
                            const timeStr = punchedAt.toLocaleTimeString("ja-JP", {
                                timeZone: "Asia/Tokyo",
                                hour: "2-digit",
                                minute: "2-digit",
                            });
                            const type = r.punch_type as "clock_in" | "clock_out";
                            const storeName =
                                r.stores && typeof r.stores === "object" && "name" in r.stores
                                    ? (r.stores as { name: string }).name
                                    : "";

                            return (
                                <div
                                    key={r.id}
                                    className="flex items-center justify-between rounded-lg bg-white border border-gray-200 px-4 py-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`inline-block w-12 text-center rounded-full px-1 py-0.5 text-xs font-semibold ${type === "clock_in"
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "bg-orange-100 text-orange-700"
                                                }`}
                                        >
                                            {punchTypeLabel(type)}
                                        </span>
                                        <span className="text-sm text-gray-600">{dateStr}</span>
                                        {storeName && (
                                            <span className="text-xs text-gray-400">{storeName}</span>
                                        )}
                                    </div>
                                    <span className="text-sm font-semibold text-gray-900 tabular-nums">
                                        {timeStr}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
