/**
 * B-004 勤怠管理（人別ビュー）受入テスト
 * - 月次集計ロジック（getMonthUTCRange, getAdjacentMonth, getCurrentMonth, buildMonthlyAttendanceSummary）
 * - ファイル存在確認
 */

import {
    buildMonthlyAttendanceDetailRows,
    buildMonthlyAttendanceSummary,
    getAdjacentMonth,
    getCurrentMonth,
    getMonthUTCRange,
    type MonthlyPunchRecord,
    type StoreOption,
} from "@/lib/attendance-utils";
import { existsSync } from "fs";
import path from "path";

// ─── ファイル存在確認 ───────────────────────────────────────────────────────────

describe("B-004 ファイル存在確認", () => {
    const basePath = path.resolve(
        __dirname,
        "../app/(admin)/attendance/staff"
    );

    test("page.tsx が存在すること", () => {
        expect(existsSync(path.join(basePath, "page.tsx"))).toBe(true);
    });

    test("StaffAttendanceClient.tsx が存在すること", () => {
        expect(
            existsSync(path.join(basePath, "StaffAttendanceClient.tsx"))
        ).toBe(true);
    });
});

// ─── getAdjacentMonth ─────────────────────────────────────────────────────────

describe("getAdjacentMonth", () => {
    test("2026-05 の前月は 2026-04", () => {
        expect(getAdjacentMonth("2026-05", "prev")).toBe("2026-04");
    });

    test("2026-05 の翌月は 2026-06", () => {
        expect(getAdjacentMonth("2026-05", "next")).toBe("2026-06");
    });

    test("年をまたぐ翌月（2026-12 → 2027-01）", () => {
        expect(getAdjacentMonth("2026-12", "next")).toBe("2027-01");
    });

    test("年をまたぐ前月（2026-01 → 2025-12）", () => {
        expect(getAdjacentMonth("2026-01", "prev")).toBe("2025-12");
    });
});

// ─── getCurrentMonth ──────────────────────────────────────────────────────────

describe("getCurrentMonth", () => {
    test("YYYY-MM 形式で返すこと", () => {
        const result = getCurrentMonth();
        expect(result).toMatch(/^\d{4}-\d{2}$/);
    });

    test("月の値が 01〜12 の範囲であること", () => {
        const result = getCurrentMonth();
        const month = parseInt(result.split("-")[1], 10);
        expect(month).toBeGreaterThanOrEqual(1);
        expect(month).toBeLessThanOrEqual(12);
    });

    test("JST 05:00 より前は前営業日側の月を返すこと", () => {
        // 2026-06-01 04:00 JST = 2026-05-31T19:00:00.000Z
        const nowMs = new Date("2026-05-31T19:00:00.000Z").getTime();
        expect(getCurrentMonth(nowMs)).toBe("2026-05");
    });

    test("JST 05:00 以降は当日の月を返すこと", () => {
        // 2026-06-01 05:00 JST = 2026-05-31T20:00:00.000Z
        const nowMs = new Date("2026-05-31T20:00:00.000Z").getTime();
        expect(getCurrentMonth(nowMs)).toBe("2026-06");
    });
});

// ─── getMonthUTCRange ─────────────────────────────────────────────────────────

describe("getMonthUTCRange", () => {
    test("2026-05 の start は 2026-04-30T20:00:00.000Z（1日の JST 05:00）", () => {
        const { start } = getMonthUTCRange("2026-05");
        expect(start).toBe("2026-04-30T20:00:00.000Z");
    });

    test("2026-05 の end は 2026-05-31T20:00:00.000Z（31日翌の JST 05:00）", () => {
        const { end } = getMonthUTCRange("2026-05");
        expect(end).toBe("2026-05-31T20:00:00.000Z");
    });

    test("2026-02 の lastDay は 28（非うるう年）", () => {
        const { lastDay } = getMonthUTCRange("2026-02");
        expect(lastDay).toBe("2026-02-28");
    });

    test("2024-02 の lastDay は 29（うるう年）", () => {
        const { lastDay } = getMonthUTCRange("2024-02");
        expect(lastDay).toBe("2024-02-29");
    });

    test("start < end であること", () => {
        const { start, end } = getMonthUTCRange("2026-05");
        expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime());
    });

    test("firstDay は YYYY-MM-01 形式", () => {
        const { firstDay } = getMonthUTCRange("2026-05");
        expect(firstDay).toBe("2026-05-01");
    });
});

// ─── buildMonthlyAttendanceSummary ────────────────────────────────────────────

describe("buildMonthlyAttendanceSummary", () => {
    const EMP_ID = "emp-001";
    const STORE_A = "store-a";
    const STORE_B = "store-b";

    const stores: StoreOption[] = [
        { id: STORE_A, name: "酒店" },
        { id: STORE_B, name: "食堂" },
    ];

    const { start, end } = getMonthUTCRange("2026-05");

    test("打刻なしの場合は空の storeBreakdowns を返すこと", () => {
        const result = buildMonthlyAttendanceSummary({
            employeeId: EMP_ID,
            employeeName: "テスト太郎",
            punches: [],
            stores,
            start,
            end,
        });
        expect(result.storeBreakdowns).toHaveLength(0);
        expect(result.totalWorkMinutes).toBe(0);
        expect(result.totalNightMinutes).toBe(0);
    });

    test("1日の通常勤務（8時間）を正しく集計すること", () => {
        // 2026-05-10 09:00〜17:00 JST（UTC: 00:00〜08:00）
        const punches: MonthlyPunchRecord[] = [
            {
                employee_id: EMP_ID,
                punch_type: "clock_in",
                punched_at: "2026-05-10T00:00:00.000Z",
                store_id: STORE_A,
            },
            {
                employee_id: EMP_ID,
                punch_type: "clock_out",
                punched_at: "2026-05-10T08:00:00.000Z",
                store_id: STORE_A,
            },
        ];

        const result = buildMonthlyAttendanceSummary({
            employeeId: EMP_ID,
            employeeName: "テスト太郎",
            punches,
            stores,
            start,
            end,
        });

        expect(result.storeBreakdowns).toHaveLength(1);
        expect(result.storeBreakdowns[0].storeId).toBe(STORE_A);
        expect(result.storeBreakdowns[0].storeName).toBe("酒店");
        expect(result.storeBreakdowns[0].workMinutes).toBe(480); // 8時間 = 480分
        expect(result.storeBreakdowns[0].nightMinutes).toBe(0);
        expect(result.totalWorkMinutes).toBe(480);
        expect(result.totalNightMinutes).toBe(0);
    });

    test("深夜帯（22:00〜翌05:00 JST）を含む勤務を正しく集計すること", () => {
        // 2026-05-10 22:00〜翌 01:00 JST（UTC: 13:00〜16:00）
        const punches: MonthlyPunchRecord[] = [
            {
                employee_id: EMP_ID,
                punch_type: "clock_in",
                punched_at: "2026-05-10T13:00:00.000Z", // 22:00 JST
                store_id: STORE_A,
            },
            {
                employee_id: EMP_ID,
                punch_type: "clock_out",
                punched_at: "2026-05-10T16:00:00.000Z", // 翌01:00 JST
                store_id: STORE_A,
            },
        ];

        const result = buildMonthlyAttendanceSummary({
            employeeId: EMP_ID,
            employeeName: "テスト太郎",
            punches,
            stores,
            start,
            end,
        });

        expect(result.storeBreakdowns[0].workMinutes).toBe(180); // 3時間
        expect(result.storeBreakdowns[0].nightMinutes).toBe(180); // 全て深夜
    });

    test("複数店舗の勤務を店舗別に集計すること", () => {
        // 店舗A: 2026-05-05 09:00〜17:00 JST → 8時間
        // 店舗B: 2026-05-12 10:00〜15:00 JST → 5時間
        const punches: MonthlyPunchRecord[] = [
            {
                employee_id: EMP_ID,
                punch_type: "clock_in",
                punched_at: "2026-05-05T00:00:00.000Z",
                store_id: STORE_A,
            },
            {
                employee_id: EMP_ID,
                punch_type: "clock_out",
                punched_at: "2026-05-05T08:00:00.000Z",
                store_id: STORE_A,
            },
            {
                employee_id: EMP_ID,
                punch_type: "clock_in",
                punched_at: "2026-05-12T01:00:00.000Z",
                store_id: STORE_B,
            },
            {
                employee_id: EMP_ID,
                punch_type: "clock_out",
                punched_at: "2026-05-12T06:00:00.000Z",
                store_id: STORE_B,
            },
        ];

        const result = buildMonthlyAttendanceSummary({
            employeeId: EMP_ID,
            employeeName: "テスト太郎",
            punches,
            stores,
            start,
            end,
        });

        expect(result.storeBreakdowns).toHaveLength(2);
        const storeA = result.storeBreakdowns.find((s) => s.storeId === STORE_A)!;
        const storeB = result.storeBreakdowns.find((s) => s.storeId === STORE_B)!;
        expect(storeA.workMinutes).toBe(480);
        expect(storeB.workMinutes).toBe(300);
        expect(result.totalWorkMinutes).toBe(780);
    });

    test("月外の打刻は集計に含まれないこと", () => {
        // 2026-04-30（前月）の打刻
        const punches: MonthlyPunchRecord[] = [
            {
                employee_id: EMP_ID,
                punch_type: "clock_in",
                punched_at: "2026-04-29T23:00:00.000Z", // 2026-04-30 08:00 JST (前月)
                store_id: STORE_A,
            },
            {
                employee_id: EMP_ID,
                punch_type: "clock_out",
                punched_at: "2026-04-30T07:00:00.000Z", // 2026-04-30 16:00 JST (前月)
                store_id: STORE_A,
            },
        ];

        const result = buildMonthlyAttendanceSummary({
            employeeId: EMP_ID,
            employeeName: "テスト太郎",
            punches,
            stores,
            start,
            end,
        });

        expect(result.totalWorkMinutes).toBe(0);
        expect(result.storeBreakdowns).toHaveLength(0);
    });

    test("未退勤（clockOut === null）は月次合計に含まれないこと", () => {
        const punches: MonthlyPunchRecord[] = [
            {
                employee_id: EMP_ID,
                punch_type: "clock_in",
                punched_at: "2026-05-15T00:00:00.000Z", // 09:00 JST
                store_id: STORE_A,
            },
            // clock_out なし
        ];

        const result = buildMonthlyAttendanceSummary({
            employeeId: EMP_ID,
            employeeName: "テスト太郎",
            punches,
            stores,
            start,
            end,
        });

        expect(result.totalWorkMinutes).toBe(0);
    });

    test("月末をまたぐ退勤（clockOut > end）は月次合計に含まれないこと", () => {
        const punches: MonthlyPunchRecord[] = [
            {
                employee_id: EMP_ID,
                punch_type: "clock_in",
                punched_at: "2026-05-31T14:00:00.000Z", // 23:00 JST
                store_id: STORE_A,
            },
            {
                employee_id: EMP_ID,
                punch_type: "clock_out",
                punched_at: "2026-05-31T21:00:00.000Z", // 06:00 JST (翌営業日, end 超過)
                store_id: STORE_A,
            },
        ];

        const result = buildMonthlyAttendanceSummary({
            employeeId: EMP_ID,
            employeeName: "テスト太郎",
            punches,
            stores,
            start,
            end,
        });

        expect(result.totalWorkMinutes).toBe(0);
        expect(result.totalNightMinutes).toBe(0);
    });

    test("店舗名が不明な店舗は store_id をフォールバックとして使うこと", () => {
        const punches: MonthlyPunchRecord[] = [
            {
                employee_id: EMP_ID,
                punch_type: "clock_in",
                punched_at: "2026-05-10T00:00:00.000Z",
                store_id: "store-unknown",
            },
            {
                employee_id: EMP_ID,
                punch_type: "clock_out",
                punched_at: "2026-05-10T08:00:00.000Z",
                store_id: "store-unknown",
            },
        ];

        const result = buildMonthlyAttendanceSummary({
            employeeId: EMP_ID,
            employeeName: "テスト太郎",
            punches,
            stores, // store-unknown は含まれない
            start,
            end,
        });

        expect(result.storeBreakdowns[0].storeName).toBe("store-unknown");
    });

    test("storeBreakdowns が店舗名の昇順で並ぶこと", () => {
        const punches: MonthlyPunchRecord[] = [
            // 食堂（先に追加）
            {
                employee_id: EMP_ID,
                punch_type: "clock_in",
                punched_at: "2026-05-05T01:00:00.000Z",
                store_id: STORE_B,
            },
            {
                employee_id: EMP_ID,
                punch_type: "clock_out",
                punched_at: "2026-05-05T06:00:00.000Z",
                store_id: STORE_B,
            },
            // 酒店（後に追加）
            {
                employee_id: EMP_ID,
                punch_type: "clock_in",
                punched_at: "2026-05-10T00:00:00.000Z",
                store_id: STORE_A,
            },
            {
                employee_id: EMP_ID,
                punch_type: "clock_out",
                punched_at: "2026-05-10T08:00:00.000Z",
                store_id: STORE_A,
            },
        ];

        const result = buildMonthlyAttendanceSummary({
            employeeId: EMP_ID,
            employeeName: "テスト太郎",
            punches,
            stores,
            start,
            end,
        });

        // 酒店 < 食堂（ja ロケール昇順）
        expect(result.storeBreakdowns[0].storeName).toBe("酒店");
        expect(result.storeBreakdowns[1].storeName).toBe("食堂");
    });
});

describe("buildMonthlyAttendanceDetailRows", () => {
    const EMP_ID = "emp-001";
    const STORE_A = "store-a";
    const stores: StoreOption[] = [{ id: STORE_A, name: "酒店" }];
    const { start, end } = getMonthUTCRange("2026-05");

    test("日付・店舗名・出退勤・勤務時間・深夜時間・ステータスが構築されること", () => {
        const punches: MonthlyPunchRecord[] = [
            {
                employee_id: EMP_ID,
                punch_type: "clock_in",
                punched_at: "2026-05-10T00:00:00.000Z", // 09:00 JST
                store_id: STORE_A,
            },
            {
                employee_id: EMP_ID,
                punch_type: "clock_out",
                punched_at: "2026-05-10T08:00:00.000Z", // 17:00 JST
                store_id: STORE_A,
            },
        ];

        const rows = buildMonthlyAttendanceDetailRows({
            employeeId: EMP_ID,
            punches,
            stores,
            start,
            end,
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].dateStr).toBe("2026-05-10");
        expect(rows[0].storeName).toBe("酒店");
        expect(rows[0].clockIn).toBe("2026-05-10T00:00:00.000Z");
        expect(rows[0].clockOut).toBe("2026-05-10T08:00:00.000Z");
        expect(rows[0].workMinutes).toBe(480);
        expect(rows[0].nightMinutes).toBe(0);
        expect(rows[0].status).toBe("completed");
    });

    test("未退勤は status=working かつ勤務時間 null になること", () => {
        const punches: MonthlyPunchRecord[] = [
            {
                employee_id: EMP_ID,
                punch_type: "clock_in",
                punched_at: "2026-05-15T00:00:00.000Z",
                store_id: STORE_A,
            },
        ];

        const rows = buildMonthlyAttendanceDetailRows({
            employeeId: EMP_ID,
            punches,
            stores,
            start,
            end,
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe("working");
        expect(rows[0].workMinutes).toBeNull();
        expect(rows[0].nightMinutes).toBeNull();
    });

    test("月末をまたぐ退勤は 05:00 またぎとして未退勤扱いになること", () => {
        // 2026-05-31 23:00 JST 〜 2026-06-01 02:00 JST
        const punches: MonthlyPunchRecord[] = [
            {
                employee_id: EMP_ID,
                punch_type: "clock_in",
                punched_at: "2026-05-31T14:00:00.000Z",
                store_id: STORE_A,
            },
            {
                employee_id: EMP_ID,
                punch_type: "clock_out",
                punched_at: "2026-05-31T21:00:00.000Z",
                store_id: STORE_A,
            },
        ];

        const rows = buildMonthlyAttendanceDetailRows({
            employeeId: EMP_ID,
            punches,
            stores,
            start,
            end,
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe("working");
        expect(rows[0].workMinutes).toBeNull();
        expect(rows[0].nightMinutes).toBeNull();
    });
});
