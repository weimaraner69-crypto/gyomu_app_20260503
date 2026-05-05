"use client";

// 勤怠管理（人別ビュー）— クライアントコンポーネント
import { useRouter } from "next/navigation";
import type {
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
    staffList: StaffItem[];
    stores: StoreOption[];
    selectedEmployeeId: string;
    selectedStoreId?: string; // undefined = 全店舗（owner/sharoushi）
    yearMonth: string; // YYYY-MM
    isManager: boolean; // manager は店舗切り替え不可
}

export function StaffAttendanceClient({
    summary,
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
        storeId?: string;
    }) {
        const sp = new URLSearchParams();
        sp.set("month", params.month ?? yearMonth);
        sp.set(
            "employee",
            params.employee ?? selectedEmployeeId
        );
        if (params.storeId ?? selectedStoreId) {
            sp.set("storeId", (params.storeId ?? selectedStoreId)!);
        }
        router.push(`/admin/attendance/staff?${sp.toString()}`);
    }

    const prevMonth = getAdjacentMonth(yearMonth, "prev");
    const nextMonth = getAdjacentMonth(yearMonth, "next");

    // YYYY-MM → 表示用（YYYY年M月）
    const [dispYear, dispMonthNum] = yearMonth.split("-").map(Number);
    const displayMonth = `${dispYear}年${dispMonthNum}月`;

    const hasData =
        summary.storeBreakdowns.length > 0 && summary.totalWorkMinutes > 0;

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
                                    storeId: e.target.value || undefined,
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

            {/* 月次サマリー */}
            <section aria-label="月次勤怠サマリー">
                <h2 className="text-lg font-semibold mb-3">
                    {summary.employeeName}　{displayMonth} 勤怠サマリー
                </h2>

                {!hasData ? (
                    <p className="text-gray-500 text-sm">
                        {displayMonth} の打刻データがありません。
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
