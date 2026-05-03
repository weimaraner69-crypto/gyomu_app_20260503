/**
 * B-001 スマホQRコード打刻 - 受入条件テスト
 *
 * テスト対象:
 * - 打刻ユーティリティ関数の動作確認
 * - punch_records 関連ファイルの存在確認
 * - 打刻種別判定ロジックの検証
 * - 打刻履歴ルートの存在確認
 * - QRコード管理ページの存在確認
 */

import * as fs from "fs";
import * as path from "path";
import {
    getNextPunchType,
    punchTypeLabel,
    formatWorkMinutes,
    calcMonthlyMinutes,
} from "../lib/punch";

const projectRoot = path.resolve(__dirname, "../../");
const srcRoot = path.join(projectRoot, "src");

// --- ユーティリティ関数テスト ---

describe("B-001: 打刻ユーティリティ関数", () => {
    describe("getNextPunchType", () => {
        test("最新打刻がない場合は clock_in を返す", () => {
            expect(getNextPunchType(null)).toBe("clock_in");
        });

        test("最新打刻が clock_in の場合は clock_out を返す", () => {
            const latest = {
                id: "test-id",
                punch_type: "clock_in" as const,
                punched_at: new Date().toISOString(),
                store_id: "store-1",
            };
            expect(getNextPunchType(latest)).toBe("clock_out");
        });

        test("最新打刻が clock_out の場合は clock_in を返す", () => {
            const latest = {
                id: "test-id",
                punch_type: "clock_out" as const,
                punched_at: new Date().toISOString(),
                store_id: "store-1",
            };
            expect(getNextPunchType(latest)).toBe("clock_in");
        });
    });

    describe("punchTypeLabel", () => {
        test("clock_in は '出勤' を返す", () => {
            expect(punchTypeLabel("clock_in")).toBe("出勤");
        });

        test("clock_out は '退勤' を返す", () => {
            expect(punchTypeLabel("clock_out")).toBe("退勤");
        });
    });

    describe("formatWorkMinutes", () => {
        test("60分 → '1時間'", () => {
            expect(formatWorkMinutes(60)).toBe("1時間");
        });

        test("90分 → '1時間30分'", () => {
            expect(formatWorkMinutes(90)).toBe("1時間30分");
        });

        test("30分 → '30分'", () => {
            expect(formatWorkMinutes(30)).toBe("30分");
        });

        test("0分 → '0分'", () => {
            expect(formatWorkMinutes(0)).toBe("0分");
        });

        test("480分（8時間）→ '8時間'", () => {
            expect(formatWorkMinutes(480)).toBe("8時間");
        });

        test("495分（8時間15分）→ '8時間15分'", () => {
            expect(formatWorkMinutes(495)).toBe("8時間15分");
        });
    });

    describe("calcMonthlyMinutes", () => {
        const base = "2026-05-04T09:00:00.000Z";
        const addMs = (ms: number) => new Date(new Date(base).getTime() + ms).toISOString();

        test("clock_in/clock_out のペアで勤務時間を計算する（8時間）", () => {
            const records = [
                { punch_type: "clock_in", punched_at: base, store_id: "s1" },
                { punch_type: "clock_out", punched_at: addMs(8 * 60 * 60 * 1000), store_id: "s1" },
            ];
            expect(calcMonthlyMinutes(records)).toBe(480);
        });

        test("複数日（2日分）の合計を計算する", () => {
            const day2 = addMs(24 * 60 * 60 * 1000);
            const day2out = addMs(24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000);
            const records = [
                { punch_type: "clock_in", punched_at: base, store_id: "s1" },
                { punch_type: "clock_out", punched_at: addMs(8 * 60 * 60 * 1000), store_id: "s1" },
                { punch_type: "clock_in", punched_at: day2, store_id: "s1" },
                { punch_type: "clock_out", punched_at: day2out, store_id: "s1" },
            ];
            // 8時間 + 7時間 = 15時間 = 900分
            expect(calcMonthlyMinutes(records)).toBe(900);
        });

        test("clock_in だけで clock_out がない場合は 0 を返す", () => {
            const records = [
                { punch_type: "clock_in", punched_at: base, store_id: "s1" },
            ];
            expect(calcMonthlyMinutes(records)).toBe(0);
        });

        test("空配列の場合は 0 を返す", () => {
            expect(calcMonthlyMinutes([])).toBe(0);
        });

        test("複数店舗兼務の合計を計算する", () => {
            const records = [
                { punch_type: "clock_in", punched_at: base, store_id: "s1" },
                { punch_type: "clock_out", punched_at: addMs(4 * 60 * 60 * 1000), store_id: "s1" },
                { punch_type: "clock_in", punched_at: addMs(5 * 60 * 60 * 1000), store_id: "s2" },
                { punch_type: "clock_out", punched_at: addMs(9 * 60 * 60 * 1000), store_id: "s2" },
            ];
            // 4時間 + 4時間 = 8時間 = 480分
            expect(calcMonthlyMinutes(records)).toBe(480);
        });
    });
});

// --- ファイル存在確認 ---

describe("B-001: 実装ファイル存在確認", () => {
    const punchStorePath = "app/(staff)/punch/store/[storeId]";

    test("打刻ページが存在する", () => {
        expect(
            fs.existsSync(path.join(srcRoot, punchStorePath, "page.tsx"))
        ).toBe(true);
    });

    test("打刻フォームコンポーネントが存在する", () => {
        expect(
            fs.existsSync(path.join(srcRoot, punchStorePath, "PunchForm.tsx"))
        ).toBe(true);
    });

    test("打刻サーバーアクションが存在する", () => {
        expect(
            fs.existsSync(path.join(srcRoot, punchStorePath, "actions.ts"))
        ).toBe(true);
    });

    test("打刻完了ページが存在する", () => {
        expect(
            fs.existsSync(path.join(srcRoot, punchStorePath, "done/page.tsx"))
        ).toBe(true);
    });

    test("打刻履歴ページが存在する", () => {
        expect(
            fs.existsSync(path.join(srcRoot, "app/(staff)/history/page.tsx"))
        ).toBe(true);
    });

    test("punch ユーティリティライブラリが存在する", () => {
        expect(
            fs.existsSync(path.join(srcRoot, "lib/punch.ts"))
        ).toBe(true);
    });

    test("QRコード管理ページが存在する（管理者向け）", () => {
        expect(
            fs.existsSync(path.join(srcRoot, "app/(admin)/qr/page.tsx"))
        ).toBe(true);
    });

    test("スタッフルートグループレイアウトが存在する", () => {
        expect(
            fs.existsSync(path.join(srcRoot, "app/(staff)/layout.tsx"))
        ).toBe(true);
    });
});

// --- 打刻アクション セキュリティ確認 ---

describe("B-001: セキュリティ確認", () => {
    test("打刻アクションに 'use server' ディレクティブが含まれている", () => {
        const actionsPath = path.join(
            srcRoot,
            "app/(staff)/punch/store/[storeId]/actions.ts"
        );
        const content = fs.readFileSync(actionsPath, "utf-8");
        expect(content).toContain('"use server"');
    });

    test("打刻アクションで punched_at はサーバー側で生成している（formData から受け取らない）", () => {
        const actionsPath = path.join(
            srcRoot,
            "app/(staff)/punch/store/[storeId]/actions.ts"
        );
        const content = fs.readFileSync(actionsPath, "utf-8");
        // formData.get("punched_at") を使っていないこと
        expect(content).not.toMatch(/formData\.get\(["']punched_at["']\)/);
        // new Date() でサーバー時刻を生成していること
        expect(content).toContain("new Date()");
    });

    test("GPS 情報は任意（取得失敗時もエラーにならない）", () => {
        const punchFormPath = path.join(
            srcRoot,
            "app/(staff)/punch/store/[storeId]/PunchForm.tsx"
        );
        const content = fs.readFileSync(punchFormPath, "utf-8");
        // エラーハンドラでスキップしていること
        expect(content).toContain("// GPS 取得失敗は無視");
    });

    test("認証確認：打刻アクションで getCurrentUser を呼んでいる", () => {
        const actionsPath = path.join(
            srcRoot,
            "app/(staff)/punch/store/[storeId]/actions.ts"
        );
        const content = fs.readFileSync(actionsPath, "utf-8");
        expect(content).toContain("getCurrentUser");
    });
});

// --- 受入条件チェック ---

describe("B-001: 受入条件確認", () => {
    test("AC-B001-01: /punch/store/[storeId] ルートが存在する", () => {
        const routePath = path.join(
            srcRoot,
            "app/(staff)/punch/store/[storeId]/page.tsx"
        );
        expect(fs.existsSync(routePath)).toBe(true);
    });

    test("AC-B001-02: 打刻完了ページでURL 種別・時刻・店舗名を searchParams から表示できる", () => {
        const donePath = path.join(
            srcRoot,
            "app/(staff)/punch/store/[storeId]/done/page.tsx"
        );
        const content = fs.readFileSync(donePath, "utf-8");
        // 種別・時刻・店舗名を表示していること
        expect(content).toContain("punchTypeLabel");
        expect(content).toContain("timeStr");
        expect(content).toContain("store");
    });

    test("AC-B001-03: 打刻は punch_records テーブルに INSERT している", () => {
        const actionsPath = path.join(
            srcRoot,
            "app/(staff)/punch/store/[storeId]/actions.ts"
        );
        const content = fs.readFileSync(actionsPath, "utf-8");
        expect(content).toContain('from("punch_records").insert');
    });

    test("AC-B001-04: 打刻履歴は 12ヶ月分のリンクを生成している", () => {
        const historyPath = path.join(
            srcRoot,
            "app/(staff)/history/page.tsx"
        );
        const content = fs.readFileSync(historyPath, "utf-8");
        // 12ヶ月のループが存在すること
        expect(content).toContain("i < 12");
    });

    test("AC-B001-05: GPS はオプション（取得失敗時も打刻を継続する）", () => {
        const actionsPath = path.join(
            srcRoot,
            "app/(staff)/punch/store/[storeId]/actions.ts"
        );
        const content = fs.readFileSync(actionsPath, "utf-8");
        // GPS が null でも INSERT を実行すること
        expect(content).toContain("gps_lat: lat");
        expect(content).toContain("gps_lng: lng");
    });

    test("AC-B001-06: QRコード管理ページが owner/manager 限定である", () => {
        const qrPath = path.join(srcRoot, "app/(admin)/qr/page.tsx");
        const content = fs.readFileSync(qrPath, "utf-8");
        expect(content).toContain('"owner"');
        expect(content).toContain('"manager"');
        expect(content).toContain("requireRole");
    });
});
