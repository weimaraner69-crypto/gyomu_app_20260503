// スタッフ管理ページ（仮パスワード発行）
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { issueTemporaryPassword } from "./actions";

interface Props {
  searchParams: Promise<{ error?: string; success?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_employee: "スタッフを選択してください。",
  forbidden: "この操作を実行する権限がありません。",
  employee_not_found: "スタッフが見つかりません。",
  user_not_found: "対象スタッフのアカウントが存在しません。",
  password_update_failed: "パスワードの更新に失敗しました。",
  email_failed: "メールの送信に失敗しました。パスワードは更新されています。",
};

export default async function StaffPage({ searchParams }: Props) {
  await requireRole(["owner", "manager"]);

  const { error, success } = await searchParams;

  const supabase = await createClient();
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name_kanji, email, role, status")
    .order("name_kana");

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "エラーが発生しました。") : null;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">スタッフ管理</h2>

      {success && (
        <div
          role="status"
          className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700"
        >
          {decodeURIComponent(success)} さんに仮パスワードを送信しました。
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
        >
          {errorMessage}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-700">氏名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">メールアドレス</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">ロール</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">操作</th>
            </tr>
          </thead>
          <tbody>
            {employees?.map((emp) => (
              <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{emp.name_kanji}</td>
                <td className="px-4 py-3 text-gray-600">{emp.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-block text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    {emp.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <form action={issueTemporaryPassword}>
                    <input type="hidden" name="employeeId" value={emp.id} />
                    <button
                      type="submit"
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors"
                    >
                      仮パスワード発行
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(!employees || employees.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  スタッフが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
