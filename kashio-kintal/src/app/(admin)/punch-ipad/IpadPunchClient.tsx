"use client";
// iPad 打刻クライアントコンポーネント
import { useState, useEffect, useCallback, useTransition } from "react";
import { executeIpadPunch, IpadPunchResult } from "./actions";
import { EmployeeWithTodayStatus, punchTypeLabel } from "@/lib/punch";

interface StoreInfo {
    id: string;
    name: string;
}

interface Props {
    stores: StoreInfo[];
    initialStoreId: string;
    initialEmployees: EmployeeWithTodayStatus[];
}

type View = "list" | "confirm" | "done";

export default function IpadPunchClient({
    stores,
    initialStoreId,
    initialEmployees,
}: Props) {
    const [selectedStoreId, setSelectedStoreId] = useState(initialStoreId);
    const [employees] = useState(initialEmployees);
    const [view, setView] = useState<View>("list");
    const [selectedEmployee, setSelectedEmployee] =
        useState<EmployeeWithTodayStatus | null>(null);
    const [result, setResult] = useState<IpadPunchResult | null>(null);
    const [countdown, setCountdown] = useState(3);
    const [isPending, startTransition] = useTransition();

    // 店舗切り替え時にサーバーから最新データを取得するためページ遷移
    const handleStoreChange = useCallback((storeId: string) => {
        setSelectedStoreId(storeId);
        const url = new URL(window.location.href);
        url.searchParams.set("storeId", storeId);
        window.location.href = url.toString();
    }, []);

    // スタッフ選択
    const handleSelectEmployee = (emp: EmployeeWithTodayStatus) => {
        setSelectedEmployee(emp);
        setView("confirm");
    };

    // 打刻確定
    const handleConfirm = () => {
        if (!selectedEmployee) return;
        startTransition(async () => {
            const res = await executeIpadPunch(
                selectedStoreId,
                selectedEmployee.id
            );
            setResult(res);
            if (res.success) {
                setView("done");
                setCountdown(3);
            }
        });
    };

    // 完了後のカウントダウン自動リセット（setState は setTimeout 内で実行）
    useEffect(() => {
        if (view !== "done") return;
        const timer = setTimeout(() => {
            if (countdown <= 0) {
                setView("list");
                setSelectedEmployee(null);
                setResult(null);
                setCountdown(3);
                window.location.reload();
            } else {
                setCountdown((c) => c - 1);
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [view, countdown]);

    const storeName = stores.find((s) => s.id === selectedStoreId)?.name ?? "";

    // ---- 確認画面 ----
    if (view === "confirm" && selectedEmployee) {
        const nextType =
            selectedEmployee.latestTodayPunchType === "clock_in"
                ? "clock_out"
                : "clock_in";
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
                <div className="text-center">
                    <p className="text-4xl font-bold text-gray-900 mb-3">
                        {selectedEmployee.name}
                    </p>
                    <p className="text-2xl text-gray-600">
                        {storeName} で
                        <span
                            className={
                                nextType === "clock_in"
                                    ? "text-green-600 font-bold"
                                    : "text-orange-500 font-bold"
                            }
                        >
                            {punchTypeLabel(nextType)}
                        </span>
                        します
                    </p>
                    {selectedEmployee.latestTodayPunchType === "clock_in" &&
                        selectedEmployee.latestTodayPunchedAt && (
                            <p className="mt-2 text-sm text-gray-400">
                                出勤:{" "}
                                {new Date(
                                    selectedEmployee.latestTodayPunchedAt
                                ).toLocaleTimeString("ja-JP", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </p>
                        )}
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setView("list")}
                        className="px-8 py-4 text-xl rounded-2xl border-2 border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                        disabled={isPending}
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isPending}
                        className={`px-8 py-4 text-xl font-bold rounded-2xl text-white transition-colors ${nextType === "clock_in"
                            ? "bg-green-500 hover:bg-green-600"
                            : "bg-orange-500 hover:bg-orange-600"
                            } disabled:opacity-50`}
                    >
                        {isPending
                            ? "処理中..."
                            : `${punchTypeLabel(nextType)}する`}
                    </button>
                </div>
                {result?.error && (
                    <p className="text-red-500 text-lg">{result.error}</p>
                )}
            </div>
        );
    }

    // ---- 完了画面 ----
    if (view === "done" && result?.success) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <div className="text-center">
                    <p className="text-6xl mb-4">✅</p>
                    <p className="text-3xl font-bold text-gray-900 mb-2">
                        打刻完了
                    </p>
                    <p className="text-xl text-gray-600">
                        {selectedEmployee?.name} さん —{" "}
                        <span className="font-semibold">
                            {punchTypeLabel(result.punchType!)}
                        </span>
                    </p>
                    {result.punchedAt && (
                        <p className="mt-1 text-lg text-gray-500">
                            {new Date(result.punchedAt).toLocaleTimeString(
                                "ja-JP",
                                {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                }
                            )}
                        </p>
                    )}
                </div>
                <p className="text-gray-400 text-lg">
                    {countdown} 秒後に自動でリセットされます
                </p>
                <button
                    onClick={() => {
                        setView("list");
                        setSelectedEmployee(null);
                        setResult(null);
                        window.location.reload();
                    }}
                    className="px-6 py-3 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                    今すぐリセット
                </button>
            </div>
        );
    }

    // ---- スタッフ一覧 ----
    const unclockedOut = employees.filter(
        (e) => e.latestTodayPunchType === "clock_in"
    );
    const others = employees.filter(
        (e) => e.latestTodayPunchType !== "clock_in"
    );

    return (
        <div>
            {/* 店舗切り替えドロップダウン */}
            {stores.length > 1 && (
                <div className="mb-6">
                    <select
                        value={selectedStoreId}
                        onChange={(e) => handleStoreChange(e.target.value)}
                        className="text-lg border border-gray-300 rounded-xl px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {stores.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* 未退勤スタッフ（赤バッジ）*/}
            {unclockedOut.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-sm font-semibold px-3 py-1 rounded-full">
                            ⚠️ 退勤未打刻
                        </span>
                        <span className="text-sm text-gray-500">
                            {unclockedOut.length}名
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {unclockedOut.map((emp) => (
                            <EmployeeButton
                                key={emp.id}
                                emp={emp}
                                variant="unclocked"
                                onClick={() => handleSelectEmployee(emp)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* その他スタッフ */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {others.map((emp) => (
                    <EmployeeButton
                        key={emp.id}
                        emp={emp}
                        variant="normal"
                        onClick={() => handleSelectEmployee(emp)}
                    />
                ))}
            </div>

            {employees.length === 0 && (
                <p className="text-gray-500 text-center py-12">
                    この店舗にスタッフが登録されていません。
                </p>
            )}
        </div>
    );
}

interface EmployeeButtonProps {
    emp: EmployeeWithTodayStatus;
    variant: "unclocked" | "normal";
    onClick: () => void;
}

function EmployeeButton({ emp, variant, onClick }: EmployeeButtonProps) {
    const isClockedIn = emp.latestTodayPunchType === "clock_in";
    const isClockedOut = emp.latestTodayPunchType === "clock_out";

    return (
        <button
            onClick={onClick}
            className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-4 py-5 text-center transition-colors ${variant === "unclocked"
                ? "border-red-300 bg-red-50 hover:bg-red-100"
                : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
        >
            <span className="text-xl font-bold text-gray-900">{emp.name}</span>
            <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${isClockedIn
                    ? "bg-red-100 text-red-600"
                    : isClockedOut
                        ? "bg-gray-100 text-gray-500"
                        : "bg-blue-50 text-blue-500"
                    }`}
            >
                {isClockedIn ? "出勤中" : isClockedOut ? "退勤済み" : "未打刻"}
            </span>
            {emp.latestTodayPunchedAt && (
                <span className="text-xs text-gray-400">
                    {new Date(emp.latestTodayPunchedAt).toLocaleTimeString(
                        "ja-JP",
                        { hour: "2-digit", minute: "2-digit" }
                    )}
                </span>
            )}
        </button>
    );
}
