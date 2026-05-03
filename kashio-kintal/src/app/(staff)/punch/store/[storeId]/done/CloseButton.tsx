"use client";

// ウィンドウを閉じるボタン（QRで開いたタブを閉じる用）
export default function CloseButton() {
    return (
        <button
            type="button"
            onClick={() => window.close()}
            className="mt-8 w-full rounded-2xl bg-gray-900 py-4 text-lg font-semibold text-white hover:bg-gray-700 active:bg-gray-800 transition-colors"
        >
            OK
        </button>
    );
}
