"use client";

// 打刻フォーム — GPS 取得 + 打刻ボタン（クライアントコンポーネント）
import { useActionState, useEffect, useRef } from "react";
import type { PunchState } from "./actions";
import type { PunchType } from "@/lib/punch-utils";
import { punchTypeLabel } from "@/lib/punch-utils";

interface PunchFormProps {
    nextPunchType: PunchType;
    storeName: string;
    employeeName: string;
    action: (prevState: PunchState, formData: FormData) => Promise<PunchState>;
}

export default function PunchForm({
    nextPunchType,
    storeName,
    employeeName,
    action,
}: PunchFormProps) {
    const [state, formAction, isPending] = useActionState<PunchState, FormData>(
        action,
        {}
    );
    const gpsLatRef = useRef<HTMLInputElement>(null);
    const gpsLngRef = useRef<HTMLInputElement>(null);

    // コンポーネントマウント時に GPS を取得（失敗しても問題なし）
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (gpsLatRef.current)
                    gpsLatRef.current.value = String(pos.coords.latitude);
                if (gpsLngRef.current)
                    gpsLngRef.current.value = String(pos.coords.longitude);
            },
            () => {
                // GPS 取得失敗は無視（打刻は継続する）
            },
            { timeout: 5000, maximumAge: 60000 }
        );
    }, []);

    const label = punchTypeLabel(nextPunchType);
    const buttonColor =
        nextPunchType === "clock_in"
            ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
            : "bg-orange-500 hover:bg-orange-600 active:bg-orange-700";

    return (
        <form action={formAction}>
            {/* 隠しフィールド: GPS */}
            <input type="hidden" name="gps_lat" ref={gpsLatRef} />
            <input type="hidden" name="gps_lng" ref={gpsLngRef} />

            {state.error && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {state.error}
                </div>
            )}

            <div className="mb-6 rounded-xl bg-gray-50 border border-gray-200 px-5 py-4 text-center">
                <p className="text-sm text-gray-500 mb-1">店舗</p>
                <p className="text-lg font-semibold text-gray-900">{storeName}</p>
                <p className="text-sm text-gray-500 mt-3 mb-1">従業員</p>
                <p className="text-lg font-semibold text-gray-900">{employeeName}</p>
            </div>

            <button
                type="submit"
                disabled={isPending}
                className={`w-full rounded-2xl py-5 text-2xl font-bold text-white transition-colors ${buttonColor} disabled:opacity-60`}
            >
                {isPending ? "記録中…" : `${label}する`}
            </button>

            <p className="mt-4 text-center text-xs text-gray-400">
                {nextPunchType === "clock_in"
                    ? "出勤ボタンを押すと出勤時刻が記録されます"
                    : "退勤ボタンを押すと退勤時刻が記録されます"}
            </p>
        </form>
    );
}
