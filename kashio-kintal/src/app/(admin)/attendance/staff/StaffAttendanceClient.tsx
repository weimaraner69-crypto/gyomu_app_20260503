"use client";

// 勤怠管理（人別ビュー）— クライアントコンポーネント
import { useRouter } from "next/navigation";
import type {
    MonthlyAttendanceDetailRow,
    MonthlyAttendanceSummary,
    StoreOption,
} from "@/lib/attendance-utils";
import { getAdjacentMonth } from "@/lib/attendance-utils";
import { formatWorkMinutes } from "@/lib/punch-utils";

interface StaffItem {
    employeeId: string;
    employeeName: string;
}

interface Props {
    summary: MonthlyAttendanceSummary;
    details: MonthlyAttendanceDetailRow[];
    staffList: StaffItem[];
    stores: StoreOption[];
    selectedEmployeeId: string;
    selectedStoreId?: string; // undefined = 全店舗（owner/sharoushi）
    yearMonth: string; // YYYY-MM
    isManager: boolean; // manager は店舗切り替え不可
}

export function StaffAttendanceClient({
    summary,
    details,
    staffList,
    stores,
    selectedEmployeeId,
    selectedStoreId,
    yearMonth,
    isManager,
}: Props) {
    const router = useRouter();

    function navigate(params: {
        month?: string;
        employee?: string;
        storeId?: string | null;
    }) {
        const sp = new URLSearchParams();
        sp.set("month", params.month ?? yearMonth);
        sp.set(
            "employee",
            params.employee ?? selectedEmployeeId
        );
        // params.storeId:
        // - undefined: 現在の選択を維持
        // - null: フィルタ解除（storeId を URL から削除）
        // - string: 指定店舗で上書き
        const nextStoreId =
            params.storeId === undefined ? selectedStoreId : params.storeId;
        if (nextStoreId) {
            sp.set("storeId", nextStoreId);
        }
        router.push(`/admin/attendance/staff?${sp.toString()}`);
    }

    const prevMonth = getAdjacentMonth(yearMonth, "prev");
    const nextMonth = getAdjacentMonth(yearMonth, "next");

    // YYYY-MM → 表示用（YYYY年M月）
    const [dispYear, dispMonthNum] = yearMonth.split("-").map(Number);
    const displayMonth = `${dispYear}年${dispMonthNum}月`;

    const hasSummaryData = summary.storeBreakdowns.length > 0;

    function toJSTTime(isoStr: string | null): string {
        if (!isoStr) return "—";
        return new Date(isoStr).toLocaleTimeString("ja-JP", {
            timeZone: "Asia/Tokyo",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    }

    return (
        <main className="p-4 md:p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">勤怠管理（人別）</h1>

            {/* 月ナビゲーション */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate({ month: prevMonth })}
                    className="rounded border px-3 py-1 text-sm hover:bg-gray-100 active:bg-gray-200"
                    aria-label="前月"
                >
                    ← 前月
                </button>
                <span className="text-lg font-semibold min-w-[120px] text-center">
                    {displayMonth}
                </span>
                <button
                    onClick={() => navigate({ month: nextMonth })}
                    className="rounded border px-3 py-1 text-sm hover:bg-gray-100 active:bg-gray-200"
                    aria-label="翌月"
                >
                    翌月 →
                </button>
            </div>

            {/* フィルター行：店舗（owner/sharoushi のみ）+ 従業員 */}
            <div className="flex flex-wrap gap-3 mb-6">
                {!isManager && stores.length > 1 && (
                    <div className="flex items-center gap-2">
                        <label
                            htmlFor="store-select"
                            className="text-sm font-medium text-gray-700"
                        >
                            店舗
                        </label>
                        <select
                            id="store-select"
                            value={selectedStoreId ?? ""}
                            onChange={(e) =>
                                navigate({
                                    storeId: e.target.value || null,
                                    employee: undefined,
                                })
                            }
                            className="rounded border px-2 py-1 text-sm"
                        >
                            <option value="">全店舗</option>
                            {stores.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <label
                        htmlFor="employee-select"
                        className="text-sm font-medium text-gray-700"
                    >
                        スタッフ
                    </label>
                    <select
                        id="employee-select"
                        value={selectedEmployeeId}
                        onChange={(e) =>
                            navigate({ employee: e.target.value })
                        }
                        className="rounded border px-2 py-1 text-sm"
                    >
                        {staffList.map((s) => (
                            <option key={s.employeeId} value={s.employeeId}>
                                {s.employeeName}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 明細一覧 */}
            <section aria-label="人別勤怠明細" className="mb-8">
                <h2 className="text-lg font-semibold mb-3">
                    {summary.employeeName}　{displayMonth} 明細
                </h2>
                {details.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                        {displayMonth} の打刻データがありません。
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="border px-3 py-2 text-left font-medium text-gray-700">日付</th>
                                    <th className="border px-3 py-2 text-left font-medium text-gray-700">店舗</th>
                                    <th className="border px-3 py-2 text-right font-medium text-gray-700">出勤</th>
                                    <th className="border px-3 py-2 text-right font-medium text-gray-700">退勤</th>
                                    <th className="border px-3 py-2 text-right font-medium text-gray-700">勤務時間</th>
                                    <th className="border px-3 py-2 text-right font-medium text-gray-700">深夜時間</th>
                                    <th className="border px-3 py-2 text-left font-medium text-gray-700">ステータス</th>
                                </tr>
                            </thead>
                            <tbody>
                                {details.map((row, idx) => (
                                    <tr key={`${row.storeId}-${row.clockIn}-${idx}`} className="hover:bg-gray-50">
                                        <td className="border px-3 py-2">{row.dateStr}</td>
                                        <td className="border px-3 py-2">{row.storeName}</td>
                                        <td className="border px-3 py-2 text-right tabular-nums">{toJSTTime(row.clockIn)}</td>
                                        <td className="border px-3 py-2 text-right tabular-nums">{toJSTTime(row.clockOut)}</td>
                                        <td className="border px-3 py-2 text-right tabular-nums">
                                            {row.workMinutes === null ? "—" : formatWorkMinutes(row.workMinutes)}
                                        </td>
                                        <td className="border px-3 py-2 text-right tabular-nums">
                                            {row.nightMinutes === null ? "—" : formatWorkMinutes(row.nightMinutes)}
                                        </td>
                                        <td className="border px-3 py-2">
                                            {row.status === "working" ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                                    <span aria-hidden="true">⚠</span>
                                                    <span>未退勤</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                                    <span aria-hidden="true">✓</span>
                                                    <span>退勤済</span>
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* 月次サマリー */}
            <section aria-label="月次勤怠サマリー">
                <h2 className="text-lg font-semibold mb-3">
                    {summary.employeeName}　{displayMonth} 勤怠サマリー
                </h2>

                {!hasSummaryData ? (
                    <p className="text-gray-500 text-sm">
                        {details.length > 0
                            ? `${displayMonth} は未退勤データのみのため、月次合計はありません。`
                            : `${displayMonth} の打刻データがありません。`}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="border px-4 py-2 text-left font-medium text-gray-700">
                                        店舗
                                    </th>
                                    <th className="border px-4 py-2 text-right font-medium text-gray-700">
                                        通常時間
                                    </th>
                                    <th className="border px-4 py-2 text-right font-medium text-gray-700">
                                        深夜時間
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.storeBreakdowns.map((row) => (
                                    <tr
                                        key={row.storeId}
                                        className="hover:bg-gray-50"
                                    >
                                        <td className="border px-4 py-2">
                                            {row.storeName}
                                        </td>
                                        <td className="border px-4 py-2 text-right tabular-nums">
                                            {formatWorkMinutes(
                                                row.workMinutes - row.nightMinutes > 0
                                                    ? row.workMinutes - row.nightMinutes
                                                    : 0
                                            )}
                                        </td>
                                        <td className="border px-4 py-2 text-right tabular-nums">
                                            {formatWorkMinutes(row.nightMinutes)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-100 font-semibold">
                                    <td className="border px-4 py-2">
                                        全店舗 合計
                                    </td>
                                    <td className="border px-4 py-2 text-right tabular-nums">
                                        {formatWorkMinutes(
                                            summary.totalWorkMinutes -
                                                summary.totalNightMinutes > 0
                                                ? summary.totalWorkMinutes -
                                                summary.totalNightMinutes
                                                : 0
                                        )}
                                    </td>
                                    <td className="border px-4 py-2 text-right tabular-nums">
                                        {formatWorkMinutes(
                                            summary.totalNightMinutes
                                        )}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}
