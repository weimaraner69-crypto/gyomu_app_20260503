"use client";

// QRコード表示クライアントコンポーネント
import { QRCodeSVG } from "qrcode.react";

interface QrDisplayProps {
    url: string;
    storeName: string;
}

export default function QrDisplay({ url, storeName }: QrDisplayProps) {
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl border border-gray-200 print:border-0">
            <p className="text-lg font-semibold text-gray-900 print:text-xl">{storeName}</p>
            <div className="p-4 bg-white border border-gray-100 rounded-lg print:border-0">
                <QRCodeSVG value={url} size={200} level="M" />
            </div>
            <p className="text-xs text-gray-500 break-all max-w-xs text-center">{url}</p>
            <button
                type="button"
                onClick={handlePrint}
                className="mt-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 print:hidden"
            >
                印刷する
            </button>
        </div>
    );
}
