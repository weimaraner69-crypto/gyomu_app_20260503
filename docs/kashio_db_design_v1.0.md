# 株式会社樫尾商店 勤怠管理システム DB設計書

**作成日:** 2026年4月30日  
**版:** 1.0

---

## テーブル一覧

| カテゴリ | テーブル名 | 概要 |
|---|---|---|
| マスタ系 | stores | 店舗マスタ（酒店・食堂・どんつき） |
| マスタ系 | employees | 従業員基本情報 |
| マスタ系 | employee_stores | 所属店舗・時給（有効期間付き） |
| マスタ系 | system_settings | システム設定（深夜割増率・締め日など） |
| 打刻・勤怠系 | punch_records | 打刻の生データ（変更不可の証跡） |
| 打刻・勤怠系 | attendance_records | 1日1店舗単位の勤怠集計 |
| 打刻・勤怠系 | attendance_corrections | 勤怠修正の履歴 |
| 申請・承認系 | wage_change_requests | 時給変更申請・承認 |
| 申請・承認系 | retirement_requests | 退職申請・承認 |
| 月次処理系 | monthly_closes | 月次締め状態管理 |
| 月次処理系 | transportation_fees | 交通費 |
| 認証・ログ系 | users | ログイン情報・ロール |
| 認証・ログ系 | operation_logs | 操作ログ（全操作の証跡） |

**設計の前提:**
- 全テーブルに `id`（uuid・PK）と `created_at`（timestamp）を持たせる
- テーブル名・カラム名はスネークケース（小文字＋アンダースコア）で統一
- 削除は論理削除（データは完全保存・法令上の保存義務対応）

---

## マスタ系テーブル

### stores（店舗）

酒店・食堂・どんつきの3店舗を管理します。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | 店舗ID |
| name | varchar | NOT NULL | 店舗名（例: 酒店） |
| created_at | timestamp | NOT NULL | 作成日時 |

---

### employees（従業員）

従業員の基本情報を管理します。退職者は論理削除（status変更）で保持します。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | 従業員ID |
| name_kanji | varchar | NOT NULL | 氏名（漢字） |
| name_kana | varchar | NOT NULL | 氏名（カナ） |
| email | varchar | NOT NULL UNIQUE | メールアドレス（ログイン用） |
| employment_type | varchar | NOT NULL | 雇用形態（staff / part / employee） |
| hire_date | date | NOT NULL | 入社日 |
| status | int | NOT NULL DEFAULT 1 | 在籍状況（1:在籍中 2:退職済み給与計算中 3:アーカイブ） |
| retire_date | date | NULL | 退職日 |
| birth_date | date | NULL | 生年月日（深夜勤務年齢確認用） |
| phone | varchar | NULL | 電話番号（緊急連絡用） |
| address | varchar | NULL | 住所 |
| role | varchar | NOT NULL | ロール（owner / manager / sharoushi / staff） |
| created_at | timestamp | NOT NULL | 作成日時 |

**statusの自動移行:**
- 1→2: 退職予定日に自動移行
- 2→3: 給与支払日の翌日 00:00 に自動移行

---

### employee_stores（所属店舗・時給）

従業員の所属店舗と時給を有効期間付きで管理します。兼務・昇給の履歴がすべて残ります。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | レコードID |
| employee_id | uuid | FK NOT NULL | 従業員ID（employees.id） |
| store_id | uuid | FK NOT NULL | 店舗ID（stores.id） |
| hourly_wage | int | NOT NULL | 時給（円） |
| valid_from | date | NOT NULL | 有効期間開始日 |
| valid_to | date | NULL | 有効期間終了日（NULLは現在有効） |
| created_at | timestamp | NOT NULL | 作成日時 |

**時給の有効期間管理の例:**

| employee | store | hourly_wage | valid_from | valid_to |
|---|---|---|---|---|
| 野稲さん | 酒店 | 1,122円 | 2024-04-01 | 2024-12-31 |
| 野稲さん | 酒店 | 1,200円 | 2025-01-01 | null（現在も有効） |

---

### system_settings（システム設定）

深夜割増率・深夜時間帯・締め日・支払日などオーナーのみ変更できる設定を有効期間付きで管理します。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | レコードID |
| key | varchar | NOT NULL | 設定キー（例: night_rate / closing_day） |
| value | varchar | NOT NULL | 設定値（例: 1.25 / 31） |
| valid_from | date | NOT NULL | 有効期間開始日 |
| valid_to | date | NULL | 有効期間終了日（NULLは現在有効） |
| updated_by | uuid | FK | 変更したユーザーID（users.id） |
| updated_at | timestamp | NOT NULL | 変更日時 |

**設定キーの一覧:**

| key | 初期値 | 説明 |
|---|---|---|
| night_rate | 1.25 | 深夜割増率 |
| night_start | 22:00 | 深夜時間帯開始 |
| night_end | 05:00 | 深夜時間帯終了 |
| closing_day | 31 | 給与締め日（31=末日） |
| payment_day | 20 | 給与支払日（翌月の何日か） |

---

## 打刻・勤怠系テーブル

### punch_records（打刻レコード）

スタッフがQRを読み取った瞬間の生データです。このテーブルのデータは誰も編集・削除できません。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | レコードID |
| employee_id | uuid | FK NOT NULL | 従業員ID |
| store_id | uuid | FK NOT NULL | 店舗ID |
| punch_type | varchar | NOT NULL | 打刻種別（clock_in / clock_out） |
| punched_at | timestamp | NOT NULL | 打刻時刻（サーバ受信時刻） |
| server_recorded_at | timestamp | NOT NULL | サーバ記録時刻（証跡・変更不可） |
| gps_lat | decimal | NULL | 緯度 |
| gps_lng | decimal | NULL | 経度 |
| device_type | varchar | NULL | 端末種別（smartphone / ipad） |

---

### attendance_records（勤怠レコード）

1日1店舗単位の勤怠集計です。修正が入った場合はこのテーブルの値が更新されます。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | レコードID |
| employee_id | uuid | FK NOT NULL | 従業員ID |
| store_id | uuid | FK NOT NULL | 店舗ID |
| business_date | date | NOT NULL | 営業日（05:00基準） |
| clock_in | timestamp | NULL | 出勤時刻 |
| clock_out | timestamp | NULL | 退勤時刻 |
| work_minutes | int | NULL | 勤務時間（分） |
| night_minutes | int | NULL | 深夜時間（分） |
| status | varchar | NOT NULL | 状態（working / completed / error / locked） |
| created_at | timestamp | NOT NULL | 作成日時 |
| updated_at | timestamp | NOT NULL | 更新日時 |

**statusの説明:**

| 値 | 意味 |
|---|---|
| working | 出勤中（退勤打刻待ち） |
| completed | 正常に出退勤済み |
| error | 未退勤エラーなど |
| locked | 月次締め後でロック済み |

**打刻から勤怠レコードができるまでの流れ:**

```
① 出勤打刻 → punch_records に1行追加
             ↓
         attendance_records に status=working で1行作成

② 退勤打刻 → punch_records に1行追加
             ↓
         attendance_records の clock_out・work_minutes・night_minutes を更新
         status を completed に変更

③ 05:00をまたいでも退勤打刻なし → バッチ処理が status=error に自動更新
```

---

### attendance_corrections（勤怠修正履歴）

勤怠を修正するたびに追記されます。修正前後の値・修正者・修正理由をすべて保存します。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | レコードID |
| attendance_id | uuid | FK NOT NULL | 対象勤怠レコードID |
| corrected_by | uuid | FK NOT NULL | 修正したユーザーID |
| before_clock_in | timestamp | NULL | 修正前の出勤時刻 |
| before_clock_out | timestamp | NULL | 修正前の退勤時刻 |
| after_clock_in | timestamp | NULL | 修正後の出勤時刻 |
| after_clock_out | timestamp | NULL | 修正後の退勤時刻 |
| reason_type | varchar | NOT NULL | 修正理由（forgot / system_error / wrong / other） |
| reason_note | varchar | NULL | 修正理由の自由入力 |
| corrected_at | timestamp | NOT NULL | 修正日時 |

---

## 申請・承認系テーブル

### wage_change_requests（時給変更申請）

店長が申請し、オーナーが承認・却下します。承認後は employee_stores に新しい行が追加されます。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | レコードID |
| employee_id | uuid | FK NOT NULL | 対象従業員ID |
| store_id | uuid | FK NOT NULL | 対象店舗ID |
| requested_by | uuid | FK NOT NULL | 申請者ID |
| new_wage | int | NOT NULL | 変更後の時給（円） |
| apply_from | date | NOT NULL | 適用開始日 |
| reason | varchar | NULL | 申請理由 |
| status | varchar | NOT NULL | 状態（pending / approved / rejected） |
| approved_by | uuid | FK NULL | 承認・却下したユーザーID |
| reject_reason | varchar | NULL | 却下理由 |
| approved_at | timestamp | NULL | 承認・却下日時 |
| created_at | timestamp | NOT NULL | 申請日時 |

---

### retirement_requests（退職申請）

店長が申請し、オーナーが承認・却下します。承認後は退職予定日に employees.status が自動更新されます。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | レコードID |
| employee_id | uuid | FK NOT NULL | 対象従業員ID |
| requested_by | uuid | FK NOT NULL | 申請者ID |
| retire_date | date | NOT NULL | 退職予定日 |
| retire_reason | varchar | NOT NULL | 退職理由（voluntary / contract_end / other） |
| retire_note | varchar | NULL | 退職理由の自由入力 |
| status | varchar | NOT NULL | 状態（pending / approved / rejected） |
| approved_by | uuid | FK NULL | 承認・却下したユーザーID |
| reject_reason | varchar | NULL | 却下理由 |
| approved_at | timestamp | NULL | 承認・却下日時 |
| created_at | timestamp | NOT NULL | 申請日時 |

---

## 月次処理系テーブル

### monthly_closes（月次締め）

店舗ごと・月ごとの締め状態を管理します。statusがapprovedになるとCSV出力が解放されます。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | レコードID |
| store_id | uuid | FK NOT NULL | 店舗ID |
| year | int | NOT NULL | 対象年 |
| month | int | NOT NULL | 対象月 |
| status | varchar | NOT NULL | 状態（open / store_closed / approved） |
| store_closed_by | uuid | FK NULL | 店舗締めを実行したユーザーID |
| store_closed_at | timestamp | NULL | 店舗締め日時 |
| approved_by | uuid | FK NULL | 最終承認したユーザーID |
| approved_at | timestamp | NULL | 最終承認日時 |
| created_at | timestamp | NOT NULL | 作成日時 |

**statusの説明:**

| 値 | 意味 | 対応ステップ |
|---|---|---|
| open | 進行中・修正可能 | STEP1〜1.5 |
| store_closed | 店舗締め済み | STEP2完了 |
| approved | 最終承認済み・完全ロック | STEP4完了 |

---

### transportation_fees（交通費）

月次締めワークフローのSTEP1.5で入力します。月次締めがapprovedになると修正不可になります。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | レコードID |
| employee_id | uuid | FK NOT NULL | 従業員ID |
| store_id | uuid | FK NOT NULL | 店舗ID |
| year | int | NOT NULL | 対象年 |
| month | int | NOT NULL | 対象月 |
| amount | int | NOT NULL | 交通費（円） |
| note | varchar | NULL | 備考（例: 4月分バス代） |
| entered_by | uuid | FK NOT NULL | 入力したユーザーID |
| entered_at | timestamp | NOT NULL | 入力日時 |

---

## 認証・ログ系テーブル

### users（ユーザー）

ログイン情報とロールを管理します。employeesと1対1で紐づきます。退職者は is_active=false でログイン不可にします。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | ユーザーID |
| employee_id | uuid | FK NOT NULL UNIQUE | 従業員ID |
| email | varchar | NOT NULL UNIQUE | メールアドレス |
| password_hash | varchar | NOT NULL | パスワード（ハッシュ化） |
| role | varchar | NOT NULL | ロール（owner / manager / sharoushi / staff） |
| is_active | boolean | NOT NULL DEFAULT true | 有効フラグ（falseでログイン不可） |
| last_login_at | timestamp | NULL | 最終ログイン日時 |
| created_at | timestamp | NOT NULL | 作成日時 |

---

### operation_logs（操作ログ）

誰が・いつ・何を・どう変えたかを記録します。社労士の閲覧履歴や管理者の操作もすべて残ります。

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| id | uuid | PK | レコードID |
| user_id | uuid | FK NOT NULL | 操作したユーザーID |
| action | varchar | NOT NULL | 操作種別（例: update_attendance / approve_wage） |
| target_table | varchar | NULL | 操作対象テーブル名 |
| target_id | uuid | NULL | 操作対象レコードID |
| before_value | json | NULL | 変更前の値 |
| after_value | json | NULL | 変更後の値 |
| ip_address | varchar | NULL | 操作元IPアドレス |
| logged_at | timestamp | NOT NULL | 操作日時 |

---

## テーブル間のリレーション

| 参照元テーブル | 参照先テーブル | 関係の説明 |
|---|---|---|
| employees | employee_stores | 1人の従業員が複数店舗に所属できる（兼務対応） |
| stores | employee_stores | 1店舗に複数の従業員が所属できる |
| employees | wage_change_requests | 1人の従業員に対して複数の時給変更申請 |
| employees | retirement_requests | 1人の従業員に対して退職申請 |
| employees | punch_records | 1人の従業員の複数の打刻レコード |
| stores | punch_records | 1店舗の複数の打刻レコード |
| punch_records | attendance_records | 打刻から1日1店舗の勤怠レコードを生成 |
| attendance_records | attendance_corrections | 勤怠レコードに対する複数の修正履歴 |
| stores | monthly_closes | 店舗ごとの月次締め管理 |
| employees | transportation_fees | 従業員ごとの月次交通費 |
| employees | users | 従業員と認証ユーザーの1対1対応 |
| users | operation_logs | ユーザーの操作ログ |
