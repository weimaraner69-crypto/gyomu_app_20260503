// パスワードリセット リクエストページ
import { requestPasswordReset } from "./actions";

interface Props {
  searchParams: Promise<{ error?: string; sent?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { error, sent } = await searchParams;

  if (sent === "1") {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          メールを送信しました
        </h2>
        <p className="text-sm text-gray-600">
          入力したメールアドレスにパスワードリセット用のリンクを送信しました。
          メールをご確認ください。
        </p>
        <div className="mt-6 text-center">
          <a href="/login" className="text-sm text-blue-600 hover:text-blue-800">
            ログインページに戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        パスワードリセット
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        登録済みのメールアドレスを入力してください。
        パスワードリセット用のリンクをお送りします。
      </p>

      {error && (
        <div
          role="alert"
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
        >
          メールアドレスを入力してください。
        </div>
      )}

      <form action={requestPasswordReset} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            メールアドレス
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors"
        >
          リセットリンクを送信
        </button>
      </form>

      <div className="mt-4 text-center">
        <a href="/login" className="text-sm text-blue-600 hover:text-blue-800">
          ログインページに戻る
        </a>
      </div>
    </div>
  );
}
