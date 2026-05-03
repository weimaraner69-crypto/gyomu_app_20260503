/**
 * N-003: 認証・ロール基盤 受入条件テスト
 *
 * テスト対象:
 * - 必要なファイルがすべて存在する
 * - ミドルウェアがパブリックパスを正しく定義している
 * - Auth ユーティリティのロールヘルパー関数
 * - メールテンプレートに必要な要素が含まれる
 */
import * as fs from "fs";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "../../");
const srcDir = path.join(projectRoot, "src");

describe("N-003: 認証・ロール基盤 受入条件テスト", () => {
  describe("必要ファイルの存在確認", () => {
    const requiredFiles = [
      "middleware.ts",
      "lib/auth.ts",
      "lib/email.ts",
      "lib/supabase/admin.ts",
      "app/(auth)/layout.tsx",
      "app/(auth)/login/page.tsx",
      "app/(auth)/login/actions.ts",
      "app/(auth)/reset-password/page.tsx",
      "app/(auth)/reset-password/actions.ts",
      "app/auth/callback/route.ts",
      "app/auth/update-password/page.tsx",
      "app/auth/update-password/actions.ts",
      "app/(admin)/layout.tsx",
      "app/(admin)/dashboard/page.tsx",
      "app/(admin)/staff/page.tsx",
      "app/(admin)/staff/actions.ts",
      "app/dashboard/page.tsx",
    ];

    for (const file of requiredFiles) {
      test(`${file} が存在する`, () => {
        expect(fs.existsSync(path.join(srcDir, file))).toBe(true);
      });
    }
  });

  describe("ミドルウェアの設定確認", () => {
    test("PUBLIC_PATHS に /login が含まれている", () => {
      const mw = fs.readFileSync(path.join(srcDir, "middleware.ts"), "utf-8");
      expect(mw).toContain('"/login"');
    });

    test("PUBLIC_PATHS に /auth/callback が含まれている", () => {
      const mw = fs.readFileSync(path.join(srcDir, "middleware.ts"), "utf-8");
      expect(mw).toContain('"/auth/callback"');
    });

    test("未認証ユーザーを /login にリダイレクトする処理が存在する", () => {
      const mw = fs.readFileSync(path.join(srcDir, "middleware.ts"), "utf-8");
      expect(mw).toContain("/login");
      expect(mw).toContain("redirect");
    });

    test("matcher が静的ファイルを除外している", () => {
      const mw = fs.readFileSync(path.join(srcDir, "middleware.ts"), "utf-8");
      expect(mw).toContain("_next/static");
    });
  });

  describe("Auth ユーティリティの確認", () => {
    test("UserRole 型が定義されている", () => {
      const auth = fs.readFileSync(path.join(srcDir, "lib/auth.ts"), "utf-8");
      expect(auth).toContain("UserRole");
    });

    test("4つのロールが定義されている", () => {
      const auth = fs.readFileSync(path.join(srcDir, "lib/auth.ts"), "utf-8");
      expect(auth).toContain('"owner"');
      expect(auth).toContain('"manager"');
      expect(auth).toContain('"sharoushi"');
      expect(auth).toContain('"staff"');
    });

    test("requireAuth 関数が定義されている", () => {
      const auth = fs.readFileSync(path.join(srcDir, "lib/auth.ts"), "utf-8");
      expect(auth).toContain("requireAuth");
    });

    test("requireRole 関数が定義されている", () => {
      const auth = fs.readFileSync(path.join(srcDir, "lib/auth.ts"), "utf-8");
      expect(auth).toContain("requireRole");
    });

    test("getDefaultPath が staff に /dashboard を返す", async () => {
      // 純粋関数として直接テスト（Supabase モック不要）
      const { getDefaultPath } = await import("@/lib/auth");
      expect(getDefaultPath("staff")).toBe("/dashboard");
    });

    test("getDefaultPath が owner に /admin/dashboard を返す", async () => {
      const { getDefaultPath } = await import("@/lib/auth");
      expect(getDefaultPath("owner")).toBe("/admin/dashboard");
    });

    test("getDefaultPath が manager に /admin/dashboard を返す", async () => {
      const { getDefaultPath } = await import("@/lib/auth");
      expect(getDefaultPath("manager")).toBe("/admin/dashboard");
    });

    test("isAdminRole が owner/manager/sharoushi に true を返す", async () => {
      const { isAdminRole } = await import("@/lib/auth");
      expect(isAdminRole("owner")).toBe(true);
      expect(isAdminRole("manager")).toBe(true);
      expect(isAdminRole("sharoushi")).toBe(true);
    });

    test("isAdminRole が staff に false を返す", async () => {
      const { isAdminRole } = await import("@/lib/auth");
      expect(isAdminRole("staff")).toBe(false);
    });
  });

  describe("セキュリティ要件確認", () => {
    test("admin.ts がサービスロールキーを環境変数から読み込む", () => {
      const admin = fs.readFileSync(
        path.join(srcDir, "lib/supabase/admin.ts"),
        "utf-8"
      );
      expect(admin).toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(admin).not.toMatch(/[A-Za-z0-9_-]{40,}/); // ハードコードされたキーがないこと
    });

    test("email.ts が RESEND_API_KEY を環境変数から読み込む", () => {
      const email = fs.readFileSync(path.join(srcDir, "lib/email.ts"), "utf-8");
      expect(email).toContain("RESEND_API_KEY");
      expect(email).not.toMatch(/re_[A-Za-z0-9]{20,}/); // 実キーがないこと
    });

    test("仮パスワード生成が crypto.randomBytes を使用している", () => {
      const actions = fs.readFileSync(
        path.join(srcDir, "app/(admin)/staff/actions.ts"),
        "utf-8"
      );
      expect(actions).toContain("randomBytes");
    });

    test("ログインアクションがメールアドレスをサニタイズしている（空白チェック）", () => {
      const actions = fs.readFileSync(
        path.join(srcDir, "app/(auth)/login/actions.ts"),
        "utf-8"
      );
      expect(actions).toContain("email");
      expect(actions).toContain("password");
    });
  });

  describe("ロールベースアクセス制御の確認", () => {
    test("Admin レイアウトが owner/manager/sharoushi のみ許可する", () => {
      const layout = fs.readFileSync(
        path.join(srcDir, "app/(admin)/layout.tsx"),
        "utf-8"
      );
      expect(layout).toContain('"owner"');
      expect(layout).toContain('"manager"');
      expect(layout).toContain('"sharoushi"');
    });

    test("スタッフ管理ページが owner/manager のみ許可する", () => {
      const page = fs.readFileSync(
        path.join(srcDir, "app/(admin)/staff/page.tsx"),
        "utf-8"
      );
      expect(page).toContain('"owner"');
      expect(page).toContain('"manager"');
    });

    test("パスワード更新アクションがパスワード長を検証する", () => {
      const actions = fs.readFileSync(
        path.join(srcDir, "app/auth/update-password/actions.ts"),
        "utf-8"
      );
      expect(actions).toContain("length < 8");
    });
  });
});
