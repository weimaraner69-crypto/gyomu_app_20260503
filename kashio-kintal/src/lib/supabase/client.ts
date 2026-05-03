// ブラウザ（クライアントコンポーネント）用 Supabase クライアント
import { createBrowserClient } from "@supabase/ssr";

/**
 * クライアントコンポーネントから Supabase にアクセスするためのクライアントを生成する。
 * 'use client' を付けたコンポーネント内で使用すること。
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
