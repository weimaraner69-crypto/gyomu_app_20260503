// 勤怠管理（人別ビュー）— サーバーコンポーネント
import { requireRole } from "@/lib/auth";
import {
    getAllStores,
    getManagerStores,
    getMonthlyAttendanceSummary,
    getStaffList,
} from "@/lib/attendance";
import { getCurrentMonth } from "@/lib/attendance-utils";
import { redirect } from "next/navigation";
import { StaffAttendanceClient } from "./StaffAttendanceClient";

interface PageProps {
    searchParams: Promise<{
        employee?: string;
        month?: string;
        storeId?: string;
    }>;
}

export default async function StaffAttendancePage({ searchParams }: PageProps) {
    const user = await requireRole(["owner", "manager", "sharoushi"]);

    const params = await searchParams;

    // month の形式検証：YYYY-MM 以外は当月にフォールバック
    const currentMonth = getCurrentMonth();
    let yearMonth = currentMonth;
    const rawMonth = params.month ?? "";
    if (rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)) {
        const m = parseInt(rawMonth.split("-")[1], 10);
        if (m >= 1 && m <= 12) {
            yearMonth = rawMonth;
        } else {
            redirect(
                `/admin/attendance/staff?month=${currentMonth}${params.employee ? `&employee=${params.employee}` : ""}`
            );
        }
    } else if (rawMonth) {
        redirect(`/admin/attendance/staff?month=${currentMonth}`);
    }

    // manager は担当店舗のみ。owner / sharoushi は全店舗
    const stores =
        user.role === "manager"
            ? await getManagerStores(user.employeeId)
            : await getAllStores();

    if (stores.length === 0) {
        return (
            <main className="p-6">
                <h1 className="text-2xl font-bold mb-4">勤怠管理（人別）</h1>
                <p className="text-gray-500">店舗が登録されていません。</p>
            </main>
        );
    }

    // manager は担当店舗でスタッフを絞り込む
    const filterStoreId =
        user.role === "manager" ? stores[0].id : params.storeId;

    const staffList = await getStaffList({
        yearMonth,
        storeId: filterStoreId,
    });

    if (staffList.length === 0) {
        return (
            <main className="p-6">
                <h1 className="text-2xl font-bold mb-4">勤怠管理（人別）</h1>
                <p className="text-gray-500">
                    {yearMonth} に所属するスタッフが見つかりません。
                </p>
            </main>
        );
    }

    // 従業員IDの検証：存在しない場合は先頭スタッフにリダイレクト
    const rawEmployee = params.employee ?? "";
    const selectedStaff = rawEmployee
        ? staffList.find((s) => s.employeeId === rawEmployee)
        : staffList[0];

    if (!selectedStaff) {
        const redirectParams = new URLSearchParams({
            month: yearMonth,
            employee: staffList[0].employeeId,
        });
        if (filterStoreId) redirectParams.set("storeId", filterStoreId);
        redirect(`/admin/attendance/staff?${redirectParams.toString()}`);
    }

    const summary = await getMonthlyAttendanceSummary({
        employeeId: selectedStaff.employeeId,
        employeeName: selectedStaff.employeeName,
        yearMonth,
    });

    const isManager = user.role === "manager";

    return (
        <StaffAttendanceClient
            summary={summary}
            staffList={staffList}
            stores={stores}
            selectedEmployeeId={selectedStaff.employeeId}
            selectedStoreId={filterStoreId}
            yearMonth={yearMonth}
            isManager={isManager}
        />
    );
}
