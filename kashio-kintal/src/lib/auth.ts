// 認証・ロール管理ユーティリティ
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** システム内のロール定義 */
export type UserRole = "owner" | "manager" | "sharoushi" | "staff";

/** 認証済みユーザー情報 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  employeeId: string;
  passwordChangeRequired: boolean;
}

/**
 * 現在の認証ユーザーとロールを取得する。
 * 未認証または users テーブルに存在しない場合は null を返す。
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("id, email, role, employee_id")
    .eq("id", user.id)
    .single();

  if (!userData) return null;

  const passwordChangeRequired =
    user.user_metadata?.password_change_required === true;

  return {
    id: userData.id,
    email: userData.email,
    role: userData.role as UserRole,
    employeeId: userData.employee_id,
    passwordChangeRequired,
  };
}

/**
 * 認証が必要なページで使用する。
 * 未認証の場合は /login にリダイレクトする。
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * 特定のロールを要求する。
 * 権限不足の場合はトップページにリダイレクトする。
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    redirect(getDefaultPath(user.role));
  }
  return user;
}

/** ロールに応じたデフォルトリダイレクト先 */
export function getDefaultPath(role: UserRole): string {
  switch (role) {
    case "owner":
    case "manager":
    case "sharoushi":
      return "/admin/dashboard";
    case "staff":
      return "/dashboard";
    default:
      return "/dashboard";
  }
}

/** ロールが管理者系かどうかを判定する */
export function isAdminRole(role: UserRole): boolean {
  return ["owner", "manager", "sharoushi"].includes(role);
}
