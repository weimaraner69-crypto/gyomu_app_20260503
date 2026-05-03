// パスワード更新ページ（パスワードリセットリンク踏後 / 仮パスワード変更）
import { updatePassword } from "./actions";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "パスワードを入力してください。",
  mismatch: "パスワードが一致しません。",
  too_short: "パスワードは8文字以上で設定してください。",
  update_failed: "パスワードの更新に失敗しました。再度お試しください。",
};

export default async function UpdatePasswordPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "エラーが発生しました。") : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">株式会社樫尾商店</h1>
          <p className="text-sm text-gray-600 mt-1">勤怠管理システム</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            新しいパスワードを設定
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            8文字以上のパスワードを設定してください。
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <form action={updatePassword} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                新しいパスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label
                htmlFor="confirm"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                パスワード（確認）
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors"
            >
              パスワードを更新する
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
