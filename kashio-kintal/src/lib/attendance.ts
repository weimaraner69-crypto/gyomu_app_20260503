// 勤怠管理ユーティリティ — 日別集計・深夜時間計算
import { createClient } from "@/lib/supabase/server";

/** 1日分の従業員勤怠データ */
export interface DailyAttendanceRecord {
    employeeId: string;
    employeeName: string;
    clockIn: string | null; // ISO UTC
    clockOut: string | null; // ISO UTC
    workMinutes: number | null;
    nightMinutes: number | null;
    status: "working" | "completed" | "no_punch";
}

export interface StoreOption {
    id: string;
    name: string;
}

/**
 * JST の日付文字列（YYYY-MM-DD）から当日の UTC 範囲を返す。
 * JST 0:00〜翌 0:00 を UTC に変換する。
 */
export function getDateUTCRange(dateStr: string): { start: string; end: string } {
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const [year, month, day] = dateStr.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, day) - jstOffsetMs).toISOString();
    const end = new Date(Date.UTC(year, month - 1, day + 1) - jstOffsetMs).toISOString();
    return { start, end };
}

/** 今日の JST 日付を YYYY-MM-DD 形式で返す */
export function getTodayJST(): string {
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const now = new Date(Date.now() + jstOffsetMs);
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD の前日・翌日を返す */
export function getAdjacentDate(
    dateStr: string,
    direction: "prev" | "next"
): string {
    const [year, month, day] = dateStr.split("-").map(Number);
    const base = new Date(Date.UTC(year, month - 1, day));
    const offset = direction === "prev" ? -1 : 1;
    base.setUTCDate(base.getUTCDate() + offset);
    const y = base.getUTCFullYear();
    const m = String(base.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(base.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

/**
 * 深夜時間（分）を計算する。
 * 深夜帯: 22:00〜翌 5:00（JST）
 * clockOutISO が null の場合は現在時刻を使って概算する（勤務中扱い）。
 */
export function calcNightMinutes(
    clockInISO: string,
    clockOutISO: string | null
): number {
    const clockIn = new Date(clockInISO);
    const clockOut = clockOutISO ? new Date(clockOutISO) : new Date();

    if (clockOut.getTime() <= clockIn.getTime()) return 0;

    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const clockInJST = new Date(clockIn.getTime() + jstOffsetMs);
    const clockOutJST = new Date(clockOut.getTime() + jstOffsetMs);

    // 開始日（JST）から終了日（JST）まで日ごとに深夜帯との重複を計算
    const startDateUTC = Date.UTC(
        clockInJST.getUTCFullYear(),
        clockInJST.getUTCMonth(),
        clockInJST.getUTCDate()
    );
    const endDateUTC = Date.UTC(
        clockOutJST.getUTCFullYear(),
        clockOutJST.getUTCMonth(),
        clockOutJST.getUTCDate()
    );

    let nightMinutes = 0;
    let cursor = startDateUTC;

    while (cursor <= endDateUTC) {
        const cursorDate = new Date(cursor);
        const y = cursorDate.getUTCFullYear();
        const mo = cursorDate.getUTCMonth();
        const d = cursorDate.getUTCDate();

        // この日 22:00 JST 〜 翌 5:00 JST（UTC で表現）
        const night22 = new Date(Date.UTC(y, mo, d, 22) - jstOffsetMs).getTime();
        const night05 = new Date(Date.UTC(y, mo, d + 1, 5) - jstOffsetMs).getTime();

        const overlapStart = Math.max(clockIn.getTime(), night22);
        const overlapEnd = Math.min(clockOut.getTime(), night05);

        if (overlapEnd > overlapStart) {
            nightMinutes += Math.floor((overlapEnd - overlapStart) / 60000);
        }

        cursor += 24 * 60 * 60 * 1000;
    }

    return nightMinutes;
}

/**
 * 特定日・特定店舗の全スタッフ勤怠を取得する。
 * dateStr は JST の日付文字列（YYYY-MM-DD）。
 * 未退勤（working）→ 先頭、打刻なし → 中間、退勤済み → 末尾の順で返す。
 */
export async function getDailyAttendance(
    storeId: string,
    dateStr: string
): Promise<DailyAttendanceRecord[]> {
    const supabase = await createClient();
    const { start, end } = getDateUTCRange(dateStr);

    // 店舗に所属する従業員を取得
    const { data: empStores } = await supabase
        .from("employee_stores")
        .select("employee_id, employees(id, name)")
        .eq("store_id", storeId);

    if (!empStores || empStores.length === 0) return [];

    const employeeIds = empStores.map((es) => es.employee_id);

    // 当日の打刻記録を取得（昇順：最初の打刻を確実に取得するため）
    const { data: punches } = await supabase
        .from("punch_records")
        .select("employee_id, punch_type, punched_at")
        .eq("store_id", storeId)
        .in("employee_id", employeeIds)
        .gte("punched_at", start)
        .lt("punched_at", end)
        .order("punched_at", { ascending: true });

    // 各従業員の最初の clock_in と最後の clock_out を集計
    const clockInByEmployee = new Map<string, string>();
    const clockOutByEmployee = new Map<string, string>();

    for (const p of punches ?? []) {
        if (p.punch_type === "clock_in" && !clockInByEmployee.has(p.employee_id)) {
            clockInByEmployee.set(p.employee_id, p.punched_at);
        }
        if (p.punch_type === "clock_out") {
            // 最後の clock_out を保持（上書き）
            clockOutByEmployee.set(p.employee_id, p.punched_at);
        }
    }

    const records: DailyAttendanceRecord[] = empStores.map((es) => {
        const emp = es.employees as { id: string; name: string } | null;
        const clockIn = clockInByEmployee.get(es.employee_id) ?? null;
        const clockOut = clockOutByEmployee.get(es.employee_id) ?? null;

        let workMinutes: number | null = null;
        let nightMinutes: number | null = null;
        let status: DailyAttendanceRecord["status"] = "no_punch";

        if (clockIn) {
            if (clockOut) {
                const diffMs =
                    new Date(clockOut).getTime() - new Date(clockIn).getTime();
                workMinutes = Math.max(0, Math.floor(diffMs / 60000));
                nightMinutes = calcNightMinutes(clockIn, clockOut);
                status = "completed";
            } else {
                status = "working";
                // 勤務中は現在時刻まので深夜時間を概算
                nightMinutes = calcNightMinutes(clockIn, null);
            }
        }

        return {
            employeeId: es.employee_id,
            employeeName: emp?.name ?? "不明",
            clockIn,
            clockOut,
            workMinutes,
            nightMinutes,
            status,
        };
    });

    // ソート: 未退勤（working）→ 先頭、打刻なし → 中間、退勤済み → 末尾
    const order: Record<DailyAttendanceRecord["status"], number> = {
        working: 0,
        no_punch: 1,
        completed: 2,
    };
    return records.sort((a, b) => order[a.status] - order[b.status]);
}

/** 全店舗一覧を取得する */
export async function getAllStores(): Promise<StoreOption[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("stores")
        .select("id, name")
        .order("name");
    return data ?? [];
}
