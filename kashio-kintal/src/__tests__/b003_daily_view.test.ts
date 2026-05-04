/**
 * B-003 勤怠管理（日別ビュー）受入テスト
 * - 日別集計ロジック（calcNightMinutes, getDateUTCRange, getTodayJST, getAdjacentDate）
 * - ファイル存在確認
 */

import {
    buildDailyAttendanceRecords,
    calcNightMinutes,
    getDateUTCRange,
    getTodayJST,
    getAdjacentDate,
    type AttendanceEmployee,
    type AttendancePunchRecord,
    type DailyAttendanceRecord,
} from "@/lib/attendance-utils";
import { formatWorkMinutes } from "@/lib/punch-utils";
import { existsSync } from "fs";
import path from "path";

// ─── ファイル存在確認 ───────────────────────────────────────────────────────────

describe("B-003 ファイル存在確認", () => {
    const basePath = path.resolve(
        __dirname,
        "../app/(admin)/attendance/daily"
    );

    test("page.tsx が存在すること", () => {
        expect(existsSync(path.join(basePath, "page.tsx"))).toBe(true);
    });

    test("DailyAttendanceClient.tsx が存在すること", () => {
        expect(
            existsSync(path.join(basePath, "DailyAttendanceClient.tsx"))
        ).toBe(true);
    });

    test("attendance.ts が存在すること", () => {
        const libPath = path.resolve(__dirname, "../lib/attendance.ts");
        expect(existsSync(libPath)).toBe(true);
    });
});

// ─── getTodayJST ───────────────────────────────────────────────────────────────

describe("getTodayJST", () => {
    test("YYYY-MM-DD 形式で返すこと", () => {
        const result = getTodayJST();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

// ─── getAdjacentDate ──────────────────────────────────────────────────────────

describe("getAdjacentDate", () => {
    test("2026-05-10 の前日は 2026-05-09", () => {
        expect(getAdjacentDate("2026-05-10", "prev")).toBe("2026-05-09");
    });

    test("2026-05-10 の翌日は 2026-05-11", () => {
        expect(getAdjacentDate("2026-05-10", "next")).toBe("2026-05-11");
    });

    test("月末翌日が月初になること（2026-04-30 → 2026-05-01）", () => {
        expect(getAdjacentDate("2026-04-30", "next")).toBe("2026-05-01");
    });

    test("月初前日が前月末になること（2026-05-01 → 2026-04-30）", () => {
        expect(getAdjacentDate("2026-05-01", "prev")).toBe("2026-04-30");
    });
});

// ─── getDateUTCRange ──────────────────────────────────────────────────────────

describe("getDateUTCRange", () => {
    test("JST 2026-05-10 の UTC start は 営業日 05:00 基準で 2026-05-09T20:00:00.000Z", () => {
        const { start } = getDateUTCRange("2026-05-10");
        expect(start).toBe("2026-05-09T20:00:00.000Z");
    });

    test("JST 2026-05-10 の UTC end は 営業日 05:00 基準で 2026-05-10T20:00:00.000Z", () => {
        const { end } = getDateUTCRange("2026-05-10");
        expect(end).toBe("2026-05-10T20:00:00.000Z");
    });

    test("start < end であること", () => {
        const { start, end } = getDateUTCRange("2026-05-10");
        expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime());
    });
});

// ─── calcNightMinutes ─────────────────────────────────────────────────────────

describe("calcNightMinutes", () => {
    test("深夜帯なし（09:00〜17:00 JST）は 0 分", () => {
        const clockIn = "2026-05-10T00:00:00.000Z"; // 09:00 JST
        const clockOut = "2026-05-10T08:00:00.000Z"; // 17:00 JST
        expect(calcNightMinutes(clockIn, clockOut)).toBe(0);
    });

    test("22:00〜23:00 JST（60 分）は 60 分", () => {
        const clockIn = "2026-05-10T13:00:00.000Z"; // 22:00 JST
        const clockOut = "2026-05-10T14:00:00.000Z"; // 23:00 JST
        expect(calcNightMinutes(clockIn, clockOut)).toBe(60);
    });

    test("23:00〜翌 02:00 JST（180 分）は 180 分", () => {
        const clockIn = "2026-05-10T14:00:00.000Z"; // 23:00 JST
        const clockOut = "2026-05-10T17:00:00.000Z"; // 翌 02:00 JST
        expect(calcNightMinutes(clockIn, clockOut)).toBe(180);
    });

    test("21:00〜翌 06:00 JST（深夜帯 420 分）", () => {
        // 深夜帯は 22:00〜翌 05:00 = 420 分
        const clockIn = "2026-05-10T12:00:00.000Z"; // 21:00 JST
        const clockOut = "2026-05-10T21:00:00.000Z"; // 翌 06:00 JST
        expect(calcNightMinutes(clockIn, clockOut)).toBe(420);
    });

    test("clockOut が null のとき非負整数を返すこと（勤務中概算）", () => {
        const clockIn = "2026-05-10T00:00:00.000Z"; // 09:00 JST
        const result = calcNightMinutes(clockIn, null);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(result)).toBe(true);
    });

    test("clockOut === clockIn のとき 0 を返すこと", () => {
        const clockIn = "2026-05-10T13:00:00.000Z"; // 22:00 JST
        expect(calcNightMinutes(clockIn, clockIn)).toBe(0);
    });
});

// ─── formatWorkMinutes（既存関数の B-003 文脈テスト）──────────────────────────

describe("formatWorkMinutes（B-003 文脈）", () => {
    test("0 分 → '0分'", () => {
        expect(formatWorkMinutes(0)).toBe("0分");
    });

    test("90 分 → '1時間30分'", () => {
        expect(formatWorkMinutes(90)).toBe("1時間30分");
    });

    test("480 分 → '8時間'", () => {
        expect(formatWorkMinutes(480)).toBe("8時間");
    });
});

// ─── DailyAttendanceRecord 型構造テスト ──────────────────────────────────────

describe("DailyAttendanceRecord 型構造", () => {
    test("status は working / completed / no_punch のみ", () => {
        const validStatuses: DailyAttendanceRecord["status"][] = [
            "working",
            "completed",
            "no_punch",
        ];

        const record: DailyAttendanceRecord = {
            employeeId: "test-id",
            employeeName: "テスト太郎",
            clockIn: null,
            clockOut: null,
            workMinutes: null,
            nightMinutes: null,
            status: "no_punch",
        };

        expect(validStatuses).toContain(record.status);
    });
});

describe("buildDailyAttendanceRecords", () => {
    const dateStr = "2026-05-10";
    const { start, end } = getDateUTCRange(dateStr);

    test("前日出勤→当日退勤を当日分として集計すること", () => {
        const employees: AttendanceEmployee[] = [
            { employeeId: "e1", employeeName: "前日出勤" },
        ];
        const punches: AttendancePunchRecord[] = [
            // 出勤: JST 05-09 23:00 (new start=05-09T20:00Z より前)
            { employee_id: "e1", punch_type: "clock_in", punched_at: "2026-05-09T14:00:00.000Z" },
            // 退勤: JST 05-10 11:00 (new startから 6h 後 = 360分)
            { employee_id: "e1", punch_type: "clock_out", punched_at: "2026-05-10T02:00:00.000Z" },
        ];

        const result = buildDailyAttendanceRecords({
            employees,
            punches,
            start,
            end,
            dateStr,
            todayJST: "2099-01-01",
        });

        expect(result[0].status).toBe("completed");
        expect(result[0].workMinutes).toBe(360);
    });

    test("当日出勤→翌日退勤は当日範囲でクリップして集計すること", () => {
        const employees: AttendanceEmployee[] = [
            { employeeId: "e2", employeeName: "翌日退勤" },
        ];
        const punches: AttendancePunchRecord[] = [
            // 出勤: JST 05-11 02:00 (当日営業日範囲内)
            { employee_id: "e2", punch_type: "clock_in", punched_at: "2026-05-10T17:00:00.000Z" },
            // 退勤: JST 05-11 09:00 (当日営業日範囲外) → end で clampして 3h = 180分
            { employee_id: "e2", punch_type: "clock_out", punched_at: "2026-05-11T00:00:00.000Z" },
        ];

        const result = buildDailyAttendanceRecords({
            employees,
            punches,
            start,
            end,
            dateStr,
            todayJST: "2099-01-01",
        });

        expect(result[0].status).toBe("completed");
        expect(result[0].workMinutes).toBe(180);
    });

    test("複数ペアを合算できること", () => {
        const employees: AttendanceEmployee[] = [
            { employeeId: "e3", employeeName: "複数ペア" },
        ];
        const punches: AttendancePunchRecord[] = [
            { employee_id: "e3", punch_type: "clock_in", punched_at: "2026-05-10T00:00:00.000Z" }, // 09:00
            { employee_id: "e3", punch_type: "clock_out", punched_at: "2026-05-10T02:00:00.000Z" }, // 11:00
            { employee_id: "e3", punch_type: "clock_in", punched_at: "2026-05-10T03:00:00.000Z" }, // 12:00
            { employee_id: "e3", punch_type: "clock_out", punched_at: "2026-05-10T05:00:00.000Z" }, // 14:00
        ];

        const result = buildDailyAttendanceRecords({
            employees,
            punches,
            start,
            end,
            dateStr,
            todayJST: "2099-01-01",
        });

        expect(result[0].workMinutes).toBe(240);
        expect(result[0].status).toBe("completed");
    });

    test("過去日の未退勤は workMinutes/nightMinutes を null にすること", () => {
        const employees: AttendanceEmployee[] = [
            { employeeId: "e4", employeeName: "未退勤" },
        ];
        const punches: AttendancePunchRecord[] = [
            { employee_id: "e4", punch_type: "clock_in", punched_at: "2026-05-10T01:00:00.000Z" },
        ];

        const result = buildDailyAttendanceRecords({
            employees,
            punches,
            start,
            end,
            dateStr,
            todayJST: "2099-01-01",
        });

        expect(result[0].status).toBe("working");
        expect(result[0].workMinutes).toBeNull();
        expect(result[0].nightMinutes).toBeNull();
    });

    test("status 順で working → no_punch → completed に並ぶこと", () => {
        const employees: AttendanceEmployee[] = [
            { employeeId: "w", employeeName: "working" },
            { employeeId: "n", employeeName: "no_punch" },
            { employeeId: "c", employeeName: "completed" },
        ];
        const punches: AttendancePunchRecord[] = [
            { employee_id: "w", punch_type: "clock_in", punched_at: "2026-05-10T01:00:00.000Z" },
            { employee_id: "c", punch_type: "clock_in", punched_at: "2026-05-10T02:00:00.000Z" },
            { employee_id: "c", punch_type: "clock_out", punched_at: "2026-05-10T03:00:00.000Z" },
        ];

        const result = buildDailyAttendanceRecords({
            employees,
            punches,
            start,
            end,
            dateStr,
            todayJST: "2099-01-01",
        });

        expect(result.map((r) => r.status)).toEqual([
            "working",
            "no_punch",
            "completed",
        ]);
    });
});
