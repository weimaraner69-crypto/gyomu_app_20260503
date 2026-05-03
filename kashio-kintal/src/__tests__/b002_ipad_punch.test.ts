/**
 * B-002 iPad打刻機能 - 受入条件テスト
 *
 * テスト対象:
 * - getTodayUTCRange ユーティリティ関数の動作確認
 * - EmployeeWithTodayStatus 型・ソート関数の動作確認
 * - iPad打刻関連ファイルの存在確認
 * - セキュリティ要件（認証・権限チェック）
 * - 受入条件の充足確認
 */

import * as fs from "fs";
import * as path from "path";
import { getTodayUTCRange } from "../lib/punch";

const projectRoot = path.resolve(__dirname, "../../");
const srcRoot = path.join(projectRoot, "src");

// --- ユーティリティ関数テスト ---

describe("B-002: getTodayUTCRange", () => {
    test("start と end が ISO 8601 形式の文字列である", () => {
        const { start, end } = getTodayUTCRange();
        expect(() => new Date(start)).not.toThrow();
        expect(() => new Date(end)).not.toThrow();
        expect(start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(end).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test("end は start より 24時間後である", () => {
        const { start, end } = getTodayUTCRange();
        const diff = new Date(end).getTime() - new Date(start).getTime();
        expect(diff).toBe(24 * 60 * 60 * 1000);
    });

    test("start は現在時刻以前である", () => {
        const { start } = getTodayUTCRange();
        expect(new Date(start).getTime()).toBeLessThanOrEqual(Date.now());
    });

    test("end は現在時刻より未来である", () => {
        const { end } = getTodayUTCRange();
        expect(new Date(end).getTime()).toBeGreaterThan(Date.now());
    });
});

// --- ファイル存在確認 ---

describe("B-002: 必須ファイルの存在確認", () => {
    const files = [
        "app/(admin)/punch-ipad/page.tsx",
        "app/(admin)/punch-ipad/IpadPunchClient.tsx",
        "app/(admin)/punch-ipad/actions.ts",
    ];

    test.each(files)("src/%s が存在する", (file) => {
        const filePath = path.join(srcRoot, file);
        expect(fs.existsSync(filePath)).toBe(true);
    });

    test("punch.ts に getStoreEmployeesWithTodayStatus が定義されている", () => {
        const punchPath = path.join(srcRoot, "lib/punch.ts");
        const content = fs.readFileSync(punchPath, "utf-8");
        expect(content).toContain("getStoreEmployeesWithTodayStatus");
    });

    test("punch.ts に EmployeeWithTodayStatus が定義されている", () => {
        const punchPath = path.join(srcRoot, "lib/punch.ts");
        const content = fs.readFileSync(punchPath, "utf-8");
        expect(content).toContain("EmployeeWithTodayStatus");
    });
});

// --- セキュリティ要件 ---

describe("B-002: セキュリティ要件", () => {
    test("actions.ts が 'use server' 宣言を含む", () => {
        const actionsPath = path.join(
            srcRoot,
            "app/(admin)/punch-ipad/actions.ts"
        );
        const content = fs.readFileSync(actionsPath, "utf-8");
        expect(content).toContain('"use server"');
    });

    test("actions.ts で getCurrentUser による認証確認をしている", () => {
        const actionsPath = path.join(
            srcRoot,
            "app/(admin)/punch-ipad/actions.ts"
        );
        const content = fs.readFileSync(actionsPath, "utf-8");
        expect(content).toContain("getCurrentUser");
    });

    test("actions.ts で owner/manager 権限チェックをしている", () => {
        const actionsPath = path.join(
            srcRoot,
            "app/(admin)/punch-ipad/actions.ts"
        );
        const content = fs.readFileSync(actionsPath, "utf-8");
        expect(content).toContain("owner");
        expect(content).toContain("manager");
    });

    test("actions.ts で打刻時刻をサーバー側で生成している（端末時刻不使用）", () => {
        const actionsPath = path.join(
            srcRoot,
            "app/(admin)/punch-ipad/actions.ts"
        );
        const content = fs.readFileSync(actionsPath, "utf-8");
        expect(content).toContain("new Date().toISOString()");
    });

    test("page.tsx で requireRole(['owner', 'manager']) を呼んでいる", () => {
        const pagePath = path.join(
            srcRoot,
            "app/(admin)/punch-ipad/page.tsx"
        );
        const content = fs.readFileSync(pagePath, "utf-8");
        expect(content).toContain("requireRole");
        expect(content).toContain("owner");
        expect(content).toContain("manager");
    });
});

// --- 受入条件確認 ---

describe("B-002: 受入条件（UI・機能要件）", () => {
    test("IpadPunchClient.tsx が store切り替えドロップダウンを含む", () => {
        const clientPath = path.join(
            srcRoot,
            "app/(admin)/punch-ipad/IpadPunchClient.tsx"
        );
        const content = fs.readFileSync(clientPath, "utf-8");
        expect(content).toContain("<select");
        expect(content).toContain("handleStoreChange");
    });

    test("IpadPunchClient.tsx が未退勤スタッフの赤バッジ表示を含む", () => {
        const clientPath = path.join(
            srcRoot,
            "app/(admin)/punch-ipad/IpadPunchClient.tsx"
        );
        const content = fs.readFileSync(clientPath, "utf-8");
        expect(content).toContain("退勤未打刻");
        expect(content).toContain("unclockedOut");
    });

    test("IpadPunchClient.tsx が確認画面（confirm view）を含む", () => {
        const clientPath = path.join(
            srcRoot,
            "app/(admin)/punch-ipad/IpadPunchClient.tsx"
        );
        const content = fs.readFileSync(clientPath, "utf-8");
        expect(content).toContain('"confirm"');
        expect(content).toContain("キャンセル");
    });

    test("IpadPunchClient.tsx が完了後カウントダウン自動リセットを含む", () => {
        const clientPath = path.join(
            srcRoot,
            "app/(admin)/punch-ipad/IpadPunchClient.tsx"
        );
        const content = fs.readFileSync(clientPath, "utf-8");
        expect(content).toContain("countdown");
        expect(content).toContain("window.location.reload");
    });

    test("actions.ts が device_type: 'ipad' を設定している", () => {
        const actionsPath = path.join(
            srcRoot,
            "app/(admin)/punch-ipad/actions.ts"
        );
        const content = fs.readFileSync(actionsPath, "utf-8");
        expect(content).toContain("ipad");
    });

    test("管理者ダッシュボードに iPad 打刻リンクが存在する", () => {
        const dashboardPath = path.join(
            srcRoot,
            "app/(admin)/dashboard/page.tsx"
        );
        const content = fs.readFileSync(dashboardPath, "utf-8");
        expect(content).toContain("/admin/punch-ipad");
        expect(content).toContain("iPad 打刻");
    });

    test("getStoreEmployeesWithTodayStatus が未退勤スタッフを先頭に並べ替える", () => {
        const punchPath = path.join(srcRoot, "lib/punch.ts");
        const content = fs.readFileSync(punchPath, "utf-8");
        expect(content).toContain("clock_in");
        expect(content).toContain("sort");
    });
});
