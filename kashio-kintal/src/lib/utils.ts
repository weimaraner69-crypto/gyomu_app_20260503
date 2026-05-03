// shadcn/ui で使用するユーティリティ関数
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind CSS のクラス名を結合・重複解消するユーティリティ関数。
 * shadcn/ui コンポーネントで使用する。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
