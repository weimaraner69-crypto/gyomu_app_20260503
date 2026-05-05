// 勤怠管理（人別ビュー）— サーバーコンポーネント
import { requireRole } from "@/lib/auth";
import {
    getAllStores,
    getManagerStores,
    getMonthlyAttendanceViewData,
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

    function buildQuery(month: string, employee?: string, storeId?: string): string {
        const sp = new URLSearchParams({ month });
        if (employee) sp.set("employee", employee);
        if (storeId) sp.set("storeId", storeId);
        return sp.toString();
    }

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
                `/admin/attendance/staff?${buildQuery(
                    currentMonth,
                    params.employee,
                    params.storeId
                )}`
            );
        }
    } else if (rawMonth) {
        redirect(
            `/admin/attendance/staff?${buildQuery(
                currentMonth,
                params.employee,
                params.storeId
            )}`
        );
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

    // owner / sharoushi の storeId は候補店舗に含まれる値のみ許可
    if (
        user.role !== "manager" &&
        params.storeId &&
        !stores.some((s) => s.id === params.storeId)
    ) {
        redirect(
            `/admin/attendance/staff?${buildQuery(yearMonth, params.employee)}`
        );
    }

    // owner / sharoushi は店舗フィルタ指定可能。manager は担当店舗すべてを対象。
    const filterStoreId =
        user.role === "manager" ? undefined : params.storeId;

    const staffList = await getStaffList({
        yearMonth,
        storeId: filterStoreId,
        storeIds: user.role === "manager" ? stores.map((s) => s.id) : undefined,
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

    // manager は担当店舗の打刻のみ取得（担当外店舗の閲覧防止）
    const viewData = await getMonthlyAttendanceViewData({
        employeeId: selectedStaff.employeeId,
        employeeName: selectedStaff.employeeName,
        yearMonth,
        allowedStoreIds:
            user.role === "manager" ? stores.map((s) => s.id) : undefined,
    });

    const isManager = user.role === "manager";

    return (
        <StaffAttendanceClient
            summary={viewData.summary}
            details={viewData.details}
            staffList={staffList}
            stores={stores}
            selectedEmployeeId={selectedStaff.employeeId}
            selectedStoreId={filterStoreId}
            yearMonth={yearMonth}
            isManager={isManager}
        />
    );
}
