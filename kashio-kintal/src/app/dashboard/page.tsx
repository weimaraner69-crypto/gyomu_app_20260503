// スタッフ用ダッシュボード（Phase 2 打刻機能で充実させる）
import { requireAuth } from "@/lib/auth";
import { signOut } from "@/app/(auth)/login/actions";

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">樫尾商店 勤怠管理</span>
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
      <main className="px-6 py-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">マイページ</h2>
        <p className="text-gray-600">
          ようこそ、{user.email} さん
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Phase 2 以降で打刻・勤怠確認機能を追加します。
        </p>
      </main>
    </div>
  );
}
