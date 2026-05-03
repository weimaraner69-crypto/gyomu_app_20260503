-- N-002: 初期スキーマ定義（13テーブル）
-- 作成日: 2026-05-03
-- 対象: stores, employees, employee_stores, system_settings, punch_records, attendance_records, attendance_corrections, wage_change_requests, retirement_requests, monthly_closes, transportation_fees, users, operation_logs

-- ============================================================
-- 1. マスタ系テーブル
-- ============================================================

-- stores（店舗）
CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- employees（従業員）
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_kanji varchar(255) NOT NULL,
  name_kana varchar(255) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  employment_type varchar(50) NOT NULL CHECK (employment_type IN ('staff', 'part', 'employee')),
  hire_date date NOT NULL,
  status int NOT NULL DEFAULT 1 CHECK (status IN (1, 2, 3)),
  retire_date date,
  birth_date date,
  phone varchar(20),
  address varchar(500),
  role varchar(50) NOT NULL CHECK (role IN ('owner', 'manager', 'sharoushi', 'staff')),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- employee_stores（所属店舗・時給）
CREATE TABLE employee_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  hourly_wage int NOT NULL CHECK (hourly_wage > 0),
  valid_from date NOT NULL,
  valid_to date,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- system_settings（システム設定）
CREATE TABLE system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(100) NOT NULL,
  value varchar(255) NOT NULL,
  valid_from date NOT NULL,
  valid_to date,
  updated_by uuid REFERENCES employees(id),
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- 2. 打刻・勤怠系テーブル
-- ============================================================

-- punch_records（打刻レコード）
CREATE TABLE punch_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  punch_type varchar(20) NOT NULL CHECK (punch_type IN ('clock_in', 'clock_out')),
  punched_at timestamp with time zone NOT NULL,
  server_recorded_at timestamp with time zone DEFAULT now() NOT NULL,
  gps_lat decimal(10, 8),
  gps_lng decimal(11, 8),
  device_type varchar(50),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- attendance_records（勤怠レコード）
CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  business_date date NOT NULL,
  clock_in timestamp with time zone,
  clock_out timestamp with time zone,
  work_minutes int CHECK (work_minutes IS NULL OR work_minutes >= 0),
  night_minutes int CHECK (night_minutes IS NULL OR night_minutes >= 0),
  status varchar(50) NOT NULL DEFAULT 'working' CHECK (status IN ('working', 'completed', 'error', 'locked')),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- attendance_corrections（勤怠修正履歴）
CREATE TABLE attendance_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  corrected_by uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  before_clock_in timestamp with time zone,
  before_clock_out timestamp with time zone,
  after_clock_in timestamp with time zone,
  after_clock_out timestamp with time zone,
  reason_type varchar(50) NOT NULL CHECK (reason_type IN ('forgot', 'system_error', 'wrong', 'other')),
  reason_note varchar(500),
  corrected_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- 3. 申請・承認系テーブル
-- ============================================================

-- wage_change_requests（時給変更申請）
CREATE TABLE wage_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  new_wage int NOT NULL CHECK (new_wage > 0),
  apply_from date NOT NULL,
  reason varchar(500),
  status varchar(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES employees(id) ON DELETE RESTRICT,
  reject_reason varchar(500),
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- retirement_requests（退職申請）
CREATE TABLE retirement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  retire_date date NOT NULL,
  retire_reason varchar(100) NOT NULL CHECK (retire_reason IN ('voluntary', 'contract_end', 'other')),
  retire_note varchar(500),
  status varchar(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES employees(id) ON DELETE RESTRICT,
  reject_reason varchar(500),
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- 4. 月次処理系テーブル
-- ============================================================

-- monthly_closes（月次締め）
CREATE TABLE monthly_closes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  status varchar(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'store_closed', 'approved')),
  store_closed_by uuid REFERENCES employees(id) ON DELETE RESTRICT,
  store_closed_at timestamp with time zone,
  approved_by uuid REFERENCES employees(id) ON DELETE RESTRICT,
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(store_id, year, month)
);

-- transportation_fees（交通費）
CREATE TABLE transportation_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount int NOT NULL CHECK (amount >= 0),
  note varchar(255),
  entered_by uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  entered_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- 5. 認証・ログ系テーブル
-- ============================================================

-- users（ユーザー）
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  email varchar(255) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  role varchar(50) NOT NULL CHECK (role IN ('owner', 'manager', 'sharoushi', 'staff')),
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- operation_logs（操作ログ）
CREATE TABLE operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action varchar(100) NOT NULL,
  target_table varchar(100),
  target_id uuid,
  before_value jsonb,
  after_value jsonb,
  ip_address varchar(45),
  logged_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- 6. インデックス
-- ============================================================

-- employees
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_role ON employees(role);
CREATE INDEX idx_employees_status ON employees(status);

-- employee_stores
CREATE INDEX idx_employee_stores_employee_id ON employee_stores(employee_id);
CREATE INDEX idx_employee_stores_store_id ON employee_stores(store_id);
CREATE INDEX idx_employee_stores_valid_period ON employee_stores(valid_from, valid_to);

-- system_settings
CREATE INDEX idx_system_settings_key ON system_settings(key);
CREATE INDEX idx_system_settings_valid ON system_settings(valid_from, valid_to);

-- punch_records
CREATE INDEX idx_punch_records_employee_id ON punch_records(employee_id);
CREATE INDEX idx_punch_records_store_id ON punch_records(store_id);
CREATE INDEX idx_punch_records_punched_at ON punch_records(punched_at);

-- attendance_records
CREATE INDEX idx_attendance_records_employee_id ON attendance_records(employee_id);
CREATE INDEX idx_attendance_records_store_id ON attendance_records(store_id);
CREATE INDEX idx_attendance_records_business_date ON attendance_records(business_date);
CREATE INDEX idx_attendance_records_status ON attendance_records(status);

-- attendance_corrections
CREATE INDEX idx_attendance_corrections_attendance_id ON attendance_corrections(attendance_id);
CREATE INDEX idx_attendance_corrections_corrected_by ON attendance_corrections(corrected_by);

-- wage_change_requests
CREATE INDEX idx_wage_change_requests_employee_id ON wage_change_requests(employee_id);
CREATE INDEX idx_wage_change_requests_status ON wage_change_requests(status);

-- retirement_requests
CREATE INDEX idx_retirement_requests_employee_id ON retirement_requests(employee_id);
CREATE INDEX idx_retirement_requests_status ON retirement_requests(status);

-- monthly_closes
CREATE INDEX idx_monthly_closes_store_id ON monthly_closes(store_id);
CREATE INDEX idx_monthly_closes_year_month ON monthly_closes(year, month);

-- transportation_fees
CREATE INDEX idx_transportation_fees_employee_id ON transportation_fees(employee_id);
CREATE INDEX idx_transportation_fees_store_id ON transportation_fees(store_id);
CREATE INDEX idx_transportation_fees_year_month ON transportation_fees(year, month);

-- users
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- operation_logs
CREATE INDEX idx_operation_logs_user_id ON operation_logs(user_id);
CREATE INDEX idx_operation_logs_action ON operation_logs(action);
CREATE INDEX idx_operation_logs_target_table ON operation_logs(target_table);
CREATE INDEX idx_operation_logs_logged_at ON operation_logs(logged_at);

-- ============================================================
-- 7. Row Level Security (RLS) ポリシー
-- ============================================================

-- 全テーブルで RLS を有効化
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wage_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE retirement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportation_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- stores RLS
-- ============================================================
CREATE POLICY "stores_select_all" ON stores FOR SELECT USING (true);
CREATE POLICY "stores_insert_owner" ON stores FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "stores_update_owner" ON stores FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);

-- ============================================================
-- employees RLS
-- ============================================================
CREATE POLICY "employees_select_all" ON employees FOR SELECT USING (true);
CREATE POLICY "employees_insert_owner" ON employees FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "employees_update_owner" ON employees FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "employees_update_self_basic" ON employees FOR UPDATE USING (
  id = (SELECT employee_id FROM users WHERE id = auth.uid())
) WITH CHECK (
  id = (SELECT employee_id FROM users WHERE id = auth.uid())
  AND (SELECT role FROM users WHERE id = auth.uid()) IN ('owner', 'manager', 'sharoushi', 'staff')
);

-- ============================================================
-- employee_stores RLS
-- ============================================================
CREATE POLICY "employee_stores_select_all" ON employee_stores FOR SELECT USING (true);
CREATE POLICY "employee_stores_insert_owner" ON employee_stores FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "employee_stores_update_owner" ON employee_stores FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);

-- ============================================================
-- system_settings RLS
-- ============================================================
CREATE POLICY "system_settings_select_all" ON system_settings FOR SELECT USING (true);
CREATE POLICY "system_settings_insert_owner" ON system_settings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "system_settings_update_owner" ON system_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);

-- ============================================================
-- punch_records RLS（変更不可の証跡）
-- ============================================================
CREATE POLICY "punch_records_select_all" ON punch_records FOR SELECT USING (true);
CREATE POLICY "punch_records_insert_auth" ON punch_records FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
);

-- ============================================================
-- attendance_records RLS
-- ============================================================
CREATE POLICY "attendance_records_select_all" ON attendance_records FOR SELECT USING (true);
CREATE POLICY "attendance_records_insert_auth" ON attendance_records FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
);
CREATE POLICY "attendance_records_update_manager_owner" ON attendance_records FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'manager', 'sharoushi'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'manager', 'sharoushi'))
);

-- ============================================================
-- attendance_corrections RLS
-- ============================================================
CREATE POLICY "attendance_corrections_select_all" ON attendance_corrections FOR SELECT USING (true);
CREATE POLICY "attendance_corrections_insert_manager_owner" ON attendance_corrections FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'manager', 'sharoushi'))
);

-- ============================================================
-- wage_change_requests RLS
-- ============================================================
CREATE POLICY "wage_change_requests_select_all" ON wage_change_requests FOR SELECT USING (true);
CREATE POLICY "wage_change_requests_insert_manager" ON wage_change_requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'manager'))
);
CREATE POLICY "wage_change_requests_update_owner" ON wage_change_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);

-- ============================================================
-- retirement_requests RLS
-- ============================================================
CREATE POLICY "retirement_requests_select_all" ON retirement_requests FOR SELECT USING (true);
CREATE POLICY "retirement_requests_insert_manager" ON retirement_requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'manager'))
);
CREATE POLICY "retirement_requests_update_owner" ON retirement_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);

-- ============================================================
-- monthly_closes RLS
-- ============================================================
CREATE POLICY "monthly_closes_select_all" ON monthly_closes FOR SELECT USING (true);
CREATE POLICY "monthly_closes_insert_owner" ON monthly_closes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "monthly_closes_update_manager_sharoushi" ON monthly_closes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'manager', 'sharoushi'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'manager', 'sharoushi'))
);

-- ============================================================
-- transportation_fees RLS
-- ============================================================
CREATE POLICY "transportation_fees_select_all" ON transportation_fees FOR SELECT USING (true);
CREATE POLICY "transportation_fees_insert_manager" ON transportation_fees FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'manager', 'sharoushi'))
);
CREATE POLICY "transportation_fees_update_manager" ON transportation_fees FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'manager', 'sharoushi'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'manager', 'sharoushi'))
);

-- ============================================================
-- users RLS
-- ============================================================
CREATE POLICY "users_select_self" ON users FOR SELECT USING (
  id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "users_insert_owner" ON users FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "users_update_owner_or_self" ON users FOR UPDATE USING (
  id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
) WITH CHECK (
  id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
);

-- ============================================================
-- operation_logs RLS
-- ============================================================
CREATE POLICY "operation_logs_select_all" ON operation_logs FOR SELECT USING (true);
CREATE POLICY "operation_logs_insert_system" ON operation_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
);
