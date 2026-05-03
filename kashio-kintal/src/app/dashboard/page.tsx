// スタッフ用ダッシュボード
import { requireAuth } from "@/lib/auth";
import { signOut } from "@/app/(auth)/login/actions";
import Link from "next/link";

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
      <main className="px-6 py-6 max-w-lg mx-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">マイページ</h2>
        <div className="grid grid-cols-1 gap-4">
          <Link
            href="/history"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <span className="text-2xl">📋</span>
            <div>
              <p className="font-semibold text-gray-900">打刻履歴</p>
              <p className="text-xs text-gray-500">当月の勤務時間・打刻一覧</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
