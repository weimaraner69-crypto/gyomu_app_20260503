// Supabase Auth コールバックハンドラ
// メール確認・パスワードリセット・招待リンクのトークン交換を処理する
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // パスワードリセットの場合はパスワード更新ページへ
      if (type === "recovery") {
        return NextResponse.redirect(
          new URL("/auth/update-password", origin)
        );
      }
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // エラー時はログインページへ
  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", origin));
}
