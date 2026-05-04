"use client";

// 勤怠管理（日別ビュー）— クライアントコンポーネント
import { useRouter } from "next/navigation";
import type { DailyAttendanceRecord, StoreOption } from "@/lib/attendance-utils";
import { getAdjacentDate } from "@/lib/attendance-utils";
import { formatWorkMinutes } from "@/lib/punch-utils";

interface Props {
    records: DailyAttendanceRecord[];
    stores: StoreOption[];
    selectedStoreId: string;
    dateStr: string; // YYYY-MM-DD (JST)
    canEdit: boolean; // 社労士は false（閲覧のみ）
    isManager: boolean; // manager は店舗切り替え不可（仕様: 店長は担当店舗のみ）
}

/** ISO UTC → HH:MM（JST）表示 */
function toJSTTime(isoStr: string | null): string {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    return d.toLocaleTimeString("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

/** ステータスバッジ */
function StatusBadge({
    status,
}: {
    status: DailyAttendanceRecord["status"];
}) {
    if (status === "working") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                ⚠ 未退勤
            </span>
        );
    }
    if (status === "completed") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                ✓ 退勤済
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
            — 打刻なし
        </span>
    );
}

export function DailyAttendanceClient({
    records,
    stores,
    selectedStoreId,
    dateStr,
    canEdit,
    isManager,
}: Props) {
    const router = useRouter();

    function navigate(newDate: string, newStoreId: string) {
        const params = new URLSearchParams({
            date: newDate,
            storeId: newStoreId,
        });
        router.push(`/admin/attendance/daily?${params.toString()}`);
    }

    const prevDate = getAdjacentDate(dateStr, "prev");
    const nextDate = getAdjacentDate(dateStr, "next");

    const unclosed = records.filter((r) => r.status === "working");
    const selectedStore = stores.find((s) => s.id === selectedStoreId);

    // YYYY-MM-DD → 表示用（M月D日）
    const [, month, day] = dateStr.split("-").map(Number);
    const displayDate = `${month}月${day}日`;

    return (
        <main className="p-4 md:p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">勤怠管理（日別）</h1>

            {/* 未退勤エラーバナー */}
            {unclosed.length > 0 && (
                <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3">
                    <p className="text-sm font-semibold text-red-700 mb-1">
                        ⚠ 未退勤スタッフが {unclosed.length} 名います
                    </p>
                    <ul className="list-disc pl-4 text-sm text-red-600">
                        {unclosed.map((r) => (
                            <li key={r.employeeId}>
                                {r.employeeName}（出勤: {toJSTTime(r.clockIn)}）
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* コントロールバー */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                {/* 日付ナビゲーション */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate(prevDate, selectedStoreId)}
                        className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                        aria-label="前の日"
                    >
                        ←
                    </button>
                    <span className="min-w-[6rem] text-center font-medium">
                        {displayDate}
                    </span>
                    <button
                        onClick={() => navigate(nextDate, selectedStoreId)}
                        className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                        aria-label="次の日"
                    >
                        →
                    </button>
                </div>

                {/* 店舗セレクター: manager は店舗固定のため非表示（docs/kashio_phase1_scope_v1.2.md 「店長は担当店舗のみ」） */}
                {!isManager && (
                    <select
                        value={selectedStoreId}
                        onChange={(e) => navigate(dateStr, e.target.value)}
                        className="rounded border px-2 py-1 text-sm"
                        aria-label="店舗を選択"
                    >
                        {stores.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                )}

                <span className="ml-auto text-sm text-gray-500">
                    {selectedStore?.name} / {records.length} 名
                </span>
            </div>

            {/* 勤怠テーブル */}
            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-600">
                                スタッフ名
                            </th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600">
                                ステータス
                            </th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600">
                                出勤
                            </th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600">
                                退勤
                            </th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600">
                                勤務時間
                            </th>
                            <th className="px-4 py-2 text-center font-medium text-gray-600">
                                深夜時間
                            </th>
                            {canEdit && (
                                <th className="px-4 py-2 text-center font-medium text-gray-600">
                                    操作
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {records.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={canEdit ? 7 : 6}
                                    className="px-4 py-8 text-center text-gray-400"
                                >
                                    スタッフが登録されていません
                                </td>
                            </tr>
                        ) : (
                            records.map((r) => (
                                <tr
                                    key={r.employeeId}
                                    className={
                                        r.status === "working"
                                            ? "bg-red-50"
                                            : "hover:bg-gray-50"
                                    }
                                >
                                    <td className="px-4 py-3 font-medium">
                                        {r.employeeName}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <StatusBadge status={r.status} />
                                    </td>
                                    <td className="px-4 py-3 text-center tabular-nums">
                                        {toJSTTime(r.clockIn)}
                                    </td>
                                    <td className="px-4 py-3 text-center tabular-nums">
                                        {toJSTTime(r.clockOut)}
                                    </td>
                                    <td className="px-4 py-3 text-center tabular-nums">
                                        {r.workMinutes !== null
                                            ? formatWorkMinutes(r.workMinutes)
                                            : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-center tabular-nums">
                                        {r.nightMinutes !== null &&
                                            r.nightMinutes > 0
                                            ? formatWorkMinutes(r.nightMinutes)
                                            : "—"}
                                    </td>
                                    {canEdit && (
                                        <td className="px-4 py-3 text-center">
                                            {/* B-005 実装後に修正リンクを追加 */}
                                            <span className="text-xs text-gray-400">
                                                修正（準備中）
                                            </span>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
