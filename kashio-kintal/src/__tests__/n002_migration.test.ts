/**
 * N-002: system_settings 初期データマイグレーション 受入条件テスト
 *
 * テスト対象:
 * - マイグレーションファイルが存在する
 * - 必要なキー（night_rate / night_start / night_end / closing_day / payment_day）が含まれる
 */
import * as fs from "fs";
import * as path from "path";

const projectRoot = path.resolve(__dirname, "../../");
const migrationsDir = path.join(projectRoot, "supabase/migrations");

describe("N-002: DB マイグレーション 受入条件テスト", () => {
  describe("初期スキーマファイル", () => {
    test("初期スキーママイグレーションファイルが存在する", () => {
      const files = fs.readdirSync(migrationsDir);
      const schema = files.find((f) => f.includes("n002_initial_schema"));
      expect(schema).toBeDefined();
    });

    test("全13テーブルが定義されている", () => {
      const files = fs.readdirSync(migrationsDir);
      const schemaFile = files.find((f) => f.includes("n002_initial_schema"))!;
      const sql = fs.readFileSync(path.join(migrationsDir, schemaFile), "utf-8");
      const tables = [
        "stores",
        "employees",
        "employee_stores",
        "system_settings",
        "punch_records",
        "attendance_records",
        "attendance_corrections",
        "wage_change_requests",
        "retirement_requests",
        "monthly_closes",
        "transportation_fees",
        "users",
        "operation_logs",
      ];
      for (const table of tables) {
        expect(sql).toContain(`CREATE TABLE ${table}`);
      }
    });

    test("全テーブルで RLS が有効化されている", () => {
      const files = fs.readdirSync(migrationsDir);
      const schemaFile = files.find((f) => f.includes("n002_initial_schema"))!;
      const sql = fs.readFileSync(path.join(migrationsDir, schemaFile), "utf-8");
      expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    });
  });

  describe("初期データファイル", () => {
    test("system_settings 初期データマイグレーションファイルが存在する", () => {
      const files = fs.readdirSync(migrationsDir);
      const dataFile = files.find((f) => f.includes("n002_initial_data"));
      expect(dataFile).toBeDefined();
    });

    test("必要な5つのキーがすべて含まれている", () => {
      const files = fs.readdirSync(migrationsDir);
      const dataFile = files.find((f) => f.includes("n002_initial_data"))!;
      const sql = fs.readFileSync(path.join(migrationsDir, dataFile), "utf-8");
      const requiredKeys = [
        "night_rate",
        "night_start",
        "night_end",
        "closing_day",
        "payment_day",
      ];
      for (const key of requiredKeys) {
        expect(sql).toContain(key);
      }
    });

    test("night_rate の値が 1.25 である", () => {
      const files = fs.readdirSync(migrationsDir);
      const dataFile = files.find((f) => f.includes("n002_initial_data"))!;
      const sql = fs.readFileSync(path.join(migrationsDir, dataFile), "utf-8");
      expect(sql).toContain("1.25");
    });

    test("closing_day の値が 31 である", () => {
      const files = fs.readdirSync(migrationsDir);
      const dataFile = files.find((f) => f.includes("n002_initial_data"))!;
      const sql = fs.readFileSync(path.join(migrationsDir, dataFile), "utf-8");
      expect(sql).toContain("'31'");
    });

    test("payment_day の値が 20 である", () => {
      const files = fs.readdirSync(migrationsDir);
      const dataFile = files.find((f) => f.includes("n002_initial_data"))!;
      const sql = fs.readFileSync(path.join(migrationsDir, dataFile), "utf-8");
      expect(sql).toContain("'20'");
    });
  });
});
