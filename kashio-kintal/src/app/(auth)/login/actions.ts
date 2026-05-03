"use server";
// ログイン・ログアウト サーバーアクション
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDefaultPath } from "@/lib/auth";
import type { UserRole } from "@/lib/auth";

export async function signIn(formData: FormData) {
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const redirectTo = formData.get("redirectTo")?.toString() ?? "";

  if (!email || !password) {
    redirect("/login?error=missing_fields");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    redirect("/login?error=invalid_credentials");
  }

  // パスワード変更必須フラグを確認する
  if (data.user.user_metadata?.password_change_required) {
    redirect("/auth/update-password");
  }

  // users テーブルからロールを取得してリダイレクト先を決定する
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", data.user.id)
    .single();

  revalidatePath("/", "layout");

  if (redirectTo && redirectTo.startsWith("/")) {
    redirect(redirectTo);
  }

  const role = (userData?.role ?? "staff") as UserRole;
  redirect(getDefaultPath(role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
