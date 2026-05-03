// 管理者専用レイアウト — owner / manager / sharoushi のみアクセス可能
import { requireRole } from "@/lib/auth";
import { signOut } from "@/app/(auth)/login/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["owner", "manager", "sharoushi"]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div>
          <span className="font-semibold text-gray-900">樫尾商店 勤怠管理</span>
          <span className="ml-3 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {user.role}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-red-600 hover:text-red-800"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>
      <nav className="bg-white border-b border-gray-200 px-6 py-2 flex gap-6 text-sm">
        <a href="/admin/dashboard" className="text-gray-700 hover:text-blue-600">
          ダッシュボード
        </a>
        {(user.role === "owner" || user.role === "manager") && (
          <a href="/admin/staff" className="text-gray-700 hover:text-blue-600">
            スタッフ管理
          </a>
        )}
      </nav>
      <main className="px-6 py-6">{children}</main>
    </div>
  );
}
