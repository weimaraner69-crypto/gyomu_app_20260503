// 打刻ユーティリティ — 純関数・型定義（サーバー依存なし）
// クライアントコンポーネントからも import 可能。
// DB アクセスを伴う関数は @/lib/punch から import してください。

export type PunchType = "clock_in" | "clock_out";

/** 打刻種別の日本語ラベル */
export function punchTypeLabel(type: PunchType): string {
    return type === "clock_in" ? "出勤" : "退勤";
}

/** 勤務時間（分）を「N時間MM分」形式に変換する */
export function formatWorkMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}分`;
    if (m === 0) return `${h}時間`;
    return `${h}時間${m}分`;
}
