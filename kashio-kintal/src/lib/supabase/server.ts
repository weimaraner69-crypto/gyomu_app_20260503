// サーバーコンポーネント・API Routes 用 Supabase クライアント
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * サーバーコンポーネントおよび API Routes から Supabase にアクセスするためのクライアントを生成する。
 * Cookie を通じてセッション情報を読み書きする。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // サーバーコンポーネントから呼ばれた場合は書き込みをスキップする
            // セッション更新はミドルウェアが担当する
          }
        },
      },
    }
  );
}
