"use server";
// パスワードリセット リクエスト サーバーアクション
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPasswordResetEmail } from "@/lib/email";

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get("email")?.toString() ?? "";
  if (!email) {
    redirect("/auth/reset-password?error=missing_email");
  }

  const supabaseAdmin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectTo = `${appUrl}/auth/callback?type=recovery`;

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  // セキュリティ上、ユーザー存在有無に関わらず成功画面を表示する
  if (!error && data?.properties?.action_link) {
    try {
      await sendPasswordResetEmail(email, data.properties.action_link);
    } catch {
      // メール送信失敗は内部エラーとして扱い、ユーザーには成功を返す
    }
  }

  redirect("/auth/reset-password?sent=1");
}
