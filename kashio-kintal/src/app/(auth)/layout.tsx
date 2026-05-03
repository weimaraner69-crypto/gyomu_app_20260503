// 認証ページ共通レイアウト（ログイン・パスワードリセット等）
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            株式会社樫尾商店
          </h1>
          <p className="text-sm text-gray-600 mt-1">勤怠管理システム</p>
        </div>
        {children}
      </div>
    </div>
  );
}
