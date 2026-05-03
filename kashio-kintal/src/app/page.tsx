// トップページ（仮）- N-003 で認証基盤実装後にログインページへリダイレクトする
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-800">
          株式会社樫尾商店
        </h1>
        <p className="text-lg text-slate-600">勤怠管理システム</p>
        <p className="text-sm text-slate-400">
          開発環境セットアップ完了（N-001）
        </p>
      </div>
    </main>
  );
}
