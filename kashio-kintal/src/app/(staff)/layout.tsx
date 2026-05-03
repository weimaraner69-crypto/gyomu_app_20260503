// スタッフ向けルートグループ — 認証済みユーザーのみアクセス可能
import { requireAuth } from "@/lib/auth";

export default async function StaffLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await requireAuth();
    return <>{children}</>;
}
