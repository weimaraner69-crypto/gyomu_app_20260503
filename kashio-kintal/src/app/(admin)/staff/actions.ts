"use server";
// スタッフ仮パスワード発行 サーバーアクション
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTempPasswordEmail } from "@/lib/email";
import { randomBytes } from "crypto";

/** 安全なランダムパスワードを生成する（16文字英数字記号混在） */
function generateTempPassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(16);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

/**
 * スタッフへの仮パスワード発行。
 * - owner / manager のみ実行可能
 * - Supabase Admin API でパスワードを更新する
 * - Resend でメール送信する
 */
export async function issueTemporaryPassword(formData: FormData) {
  const employeeId = formData.get("employeeId")?.toString() ?? "";
  if (!employeeId) {
    redirect("/admin/staff?error=missing_employee");
  }

  const supabase = await createClient();

  // 操作者のロール確認
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) redirect("/login");

  const { data: currentUserData } = await supabase
    .from("users")
    .select("role")
    .eq("id", currentUser.id)
    .single();

  if (
    !currentUserData ||
    !["owner", "manager"].includes(currentUserData.role)
  ) {
    redirect("/admin/staff?error=forbidden");
  }

  // 対象スタッフの情報を取得する
  const { data: employee } = await supabase
    .from("employees")
    .select("id, name_kanji, email")
    .eq("id", employeeId)
    .single();

  if (!employee) {
    redirect("/admin/staff?error=employee_not_found");
  }

  // 対象スタッフの Auth ユーザー ID を取得する
  const { data: targetUser } = await supabase
    .from("users")
    .select("id")
    .eq("employee_id", employeeId)
    .single();

  if (!targetUser) {
    redirect("/admin/staff?error=user_not_found");
  }

  const tempPassword = generateTempPassword();
  const supabaseAdmin = createAdminClient();

  // パスワードを更新し、次回ログイン時に変更を強制する
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    targetUser.id,
    {
      password: tempPassword,
      user_metadata: { password_change_required: true },
    }
  );

  if (updateError) {
    redirect("/admin/staff?error=password_update_failed");
  }

  // 仮パスワードをメールで送信する
  try {
    await sendTempPasswordEmail(employee.email, employee.name_kanji, tempPassword);
  } catch {
    redirect("/admin/staff?error=email_failed");
  }

  revalidatePath("/admin/staff");
  redirect(`/admin/staff?success=${encodeURIComponent(employee.name_kanji)}`);
}
