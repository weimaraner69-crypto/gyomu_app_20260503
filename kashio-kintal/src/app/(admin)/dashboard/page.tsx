// 管理者ダッシュボード（Phase 2 以降で充実させる）
import { requireRole } from "@/lib/auth";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const user = await requireRole(["owner", "manager", "sharoushi"]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">ダッシュボード</h2>
      <p className="text-gray-600">
        ようこそ、{user.email} さん（{user.role}）
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(user.role === "owner" || user.role === "manager") && (
          <>
            <Link
              href="/admin/qr"
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl">📱</span>
              <div>
                <p className="font-semibold text-gray-900">QRコード管理</p>
                <p className="text-xs text-gray-500">店舗用QRコードを印刷する</p>
              </div>
            </Link>
            <Link
              href="/admin/punch-ipad"
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl">🖥️</span>
              <div>
                <p className="font-semibold text-gray-900">iPad 打刻</p>
                <p className="text-xs text-gray-500">スタッフ名タップで出退勤打刻</p>
              </div>
            </Link>
          </>
        )}
        <Link
          href="/admin/staff"
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <span className="text-2xl">👥</span>
          <div>
            <p className="font-semibold text-gray-900">スタッフ管理</p>
            <p className="text-xs text-gray-500">スタッフの登録・パスワード管理</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
