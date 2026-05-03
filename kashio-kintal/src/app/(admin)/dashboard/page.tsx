// 管理者ダッシュボード（Phase 2 以降で充実させる）
import { requireRole } from "@/lib/auth";

export default async function AdminDashboardPage() {
  const user = await requireRole(["owner", "manager", "sharoushi"]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">ダッシュボード</h2>
      <p className="text-gray-600">
        ようこそ、{user.email} さん（{user.role}）
      </p>
      <p className="text-sm text-gray-500 mt-2">
        Phase 2 以降でグラフ・サマリーを表示します。
      </p>
    </div>
  );
}
