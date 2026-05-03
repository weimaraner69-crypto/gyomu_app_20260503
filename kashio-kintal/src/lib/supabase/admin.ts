// サーバー専用 Supabase 管理クライアント（サービスロールキー使用）
// このファイルは Server Action / Route Handler からのみ呼び出すこと
// クライアントコンポーネントや 'use client' が付いたファイルからの import を禁止する
import { createClient } from "@supabase/supabase-js";

/**
 * サービスロールキーを使った管理クライアントを返す。
 * 仮パスワード発行・ユーザー管理など管理者専用操作に使用する。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です"
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
