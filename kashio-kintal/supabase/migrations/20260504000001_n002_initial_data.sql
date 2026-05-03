-- N-002: system_settings 初期データ投入
-- 作成日: 2026-05-04
-- 深夜割増率・深夜時間帯・締め日・支払日の初期値を設定する

INSERT INTO system_settings (key, value, valid_from)
VALUES
  ('night_rate',   '1.25',  '2026-01-01'),
  ('night_start',  '22:00', '2026-01-01'),
  ('night_end',    '05:00', '2026-01-01'),
  ('closing_day',  '31',    '2026-01-01'),
  ('payment_day',  '20',    '2026-01-01');
