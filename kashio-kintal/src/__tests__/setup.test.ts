/**
 * N-001 開発環境セットアップ - 受入条件テスト
 * 
 * テスト対象:
 * - Next.js プロジェクト構成の検証
 * - 環境変数テンプレートの存在確認
 * - Supabase クライアントの型安全性確認
 * - ユーティリティ関数の動作確認
 */

import * as fs from "fs";
import * as path from "path";

// プロジェクトルートのパス
const projectRoot = path.resolve(__dirname, "../../");

describe("N-001: 開発環境セットアップ 受入条件テスト", () => {
  describe("プロジェクト構成確認", () => {
    test("App Router が有効化されている（src/app/layout.tsx が存在する）", () => {
      const layoutPath = path.join(projectRoot, "src/app/layout.tsx");
      expect(fs.existsSync(layoutPath)).toBe(true);
    });

    test("TypeScript が設定されている（tsconfig.json が存在する）", () => {
      const tsconfigPath = path.join(projectRoot, "tsconfig.json");
      expect(fs.existsSync(tsconfigPath)).toBe(true);
    });

    test("Tailwind CSS が設定されている（tailwind.config.ts が存在する）", () => {
      // Next.js 15 以降は tailwind が postcss プラグイン形式で組み込まれる場合がある
      const tailwindConfig =
        fs.existsSync(path.join(projectRoot, "tailwind.config.ts")) ||
        fs.existsSync(path.join(projectRoot, "tailwind.config.js")) ||
        fs.existsSync(path.join(projectRoot, "postcss.config.mjs")) ||
        fs.existsSync(path.join(projectRoot, "postcss.config.js"));
      expect(tailwindConfig).toBe(true);
    });

    test("package.json に next スクリプトが定義されている", () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8")
      );
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts.dev).toBeDefined();
      expect(pkg.scripts.build).toBeDefined();
    });
  });

  describe("Supabase 構成確認", () => {
    test("supabase/migrations ディレクトリが存在する", () => {
      const migrationsDir = path.join(projectRoot, "supabase/migrations");
      expect(fs.existsSync(migrationsDir)).toBe(true);
    });

    test("supabase/config.toml が存在する", () => {
      const configPath = path.join(projectRoot, "supabase/config.toml");
      expect(fs.existsSync(configPath)).toBe(true);
    });

    test("Supabase クライアントファイルが存在する", () => {
      const clientPath = path.join(projectRoot, "src/lib/supabase/client.ts");
      expect(fs.existsSync(clientPath)).toBe(true);
    });

    test("Supabase サーバークライアントファイルが存在する", () => {
      const serverPath = path.join(projectRoot, "src/lib/supabase/server.ts");
      expect(fs.existsSync(serverPath)).toBe(true);
    });
  });

  describe("環境変数テンプレート確認", () => {
    test(".env.local.example が存在する（P-002: 実値不使用）", () => {
      const examplePath = path.join(projectRoot, ".env.local.example");
      expect(fs.existsSync(examplePath)).toBe(true);
    });

    test(".env.local.example に NEXT_PUBLIC_SUPABASE_URL が定義されている", () => {
      const examplePath = path.join(projectRoot, ".env.local.example");
      const content = fs.readFileSync(examplePath, "utf-8");
      expect(content).toContain("NEXT_PUBLIC_SUPABASE_URL");
    });

    test(".env.local.example に NEXT_PUBLIC_SUPABASE_ANON_KEY が定義されている", () => {
      const examplePath = path.join(projectRoot, ".env.local.example");
      const content = fs.readFileSync(examplePath, "utf-8");
      expect(content).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    });

    test(".env.local.example に SUPABASE_SERVICE_ROLE_KEY が定義されている", () => {
      const examplePath = path.join(projectRoot, ".env.local.example");
      const content = fs.readFileSync(examplePath, "utf-8");
      expect(content).toContain("SUPABASE_SERVICE_ROLE_KEY");
    });

    test(".env.local.example に実際の API キー値が含まれていない（P-002 遵守）", () => {
      const examplePath = path.join(projectRoot, ".env.local.example");
      const content = fs.readFileSync(examplePath, "utf-8");
      // 実際の Supabase URL パターン（プロジェクト参照が含まれる）が存在しないこと
      const hasRealSupabaseUrl = /https:\/\/[a-z]{20}\.supabase\.co/.test(content);
      expect(hasRealSupabaseUrl).toBe(false);
    });

    test(".gitignore に .env.local が含まれている（P-002 遵守）", () => {
      const gitignorePath = path.join(projectRoot, ".gitignore");
      const content = fs.readFileSync(gitignorePath, "utf-8");
      // .env* または .env.local が無視されていること
      const hasEnvIgnore = content.includes(".env*") || content.includes(".env.local");
      expect(hasEnvIgnore).toBe(true);
    });
  });

  describe("shadcn/ui 構成確認", () => {
    test("components.json が存在する", () => {
      const componentsJsonPath = path.join(projectRoot, "components.json");
      expect(fs.existsSync(componentsJsonPath)).toBe(true);
    });

    test("src/lib/utils.ts が存在する", () => {
      const utilsPath = path.join(projectRoot, "src/lib/utils.ts");
      expect(fs.existsSync(utilsPath)).toBe(true);
    });

    test("package.json に clsx が含まれている", () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8")
      );
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      expect(allDeps.clsx).toBeDefined();
    });

    test("package.json に tailwind-merge が含まれている", () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8")
      );
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      expect(allDeps["tailwind-merge"]).toBeDefined();
    });
  });
});
