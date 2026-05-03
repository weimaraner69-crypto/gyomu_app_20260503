"use server";
// パスワード更新 サーバーアクション（リセットリンク踏後・仮パスワード変更）
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updatePassword(formData: FormData) {
  const password = formData.get("password")?.toString() ?? "";
  const confirm = formData.get("confirm")?.toString() ?? "";

  if (!password || !confirm) {
    redirect("/auth/update-password?error=missing_fields");
  }
  if (password !== confirm) {
    redirect("/auth/update-password?error=mismatch");
  }
  if (password.length < 8) {
    redirect("/auth/update-password?error=too_short");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect("/auth/update-password?error=update_failed");
  }

  // パスワード変更必須フラグをクリアする（管理者 API で user_metadata を更新）
  if (user.user_metadata?.password_change_required) {
    const supabaseAdmin = createAdminClient();
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { password_change_required: false },
    });
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
