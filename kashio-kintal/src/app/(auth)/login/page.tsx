// ログインページ
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "./actions";

interface Props {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "メールアドレスまたはパスワードが正しくありません。",
  missing_fields: "メールアドレスとパスワードを入力してください。",
  auth_callback_failed: "認証処理に失敗しました。再度お試しください。",
};

export default async function LoginPage({ searchParams }: Props) {
  const { error, redirectTo } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "エラーが発生しました。") : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">ログイン</h2>

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
        >
          {errorMessage}
        </div>
      )}

      <form action={signIn} className="space-y-4">
        {redirectTo && (
          <input type="hidden" name="redirectTo" value={redirectTo} />
        )}
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
            placeholder="例：yamada@example.com"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            パスワード
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors"
        >
          ログイン
        </button>
      </form>

      <div className="mt-4 text-center">
        <a
          href="/auth/reset-password"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          パスワードを忘れた場合
        </a>
      </div>
    </div>
  );
}
