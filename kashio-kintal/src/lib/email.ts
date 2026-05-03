// Resend を使ったメール送信ユーティリティ
// Server Action / Route Handler からのみ呼び出すこと
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL =
  process.env.FROM_EMAIL ?? "noreply@kashio-kintal.example.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * パスワードリセットメールを送信する。
 * @param to 送信先メールアドレス
 * @param resetUrl パスワードリセット用 URL（Supabase の reset link）
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "【樫尾商店 勤怠管理】パスワードリセットのご案内",
    html: `
      <h2>パスワードリセットのご案内</h2>
      <p>パスワードリセットのリクエストを受け付けました。</p>
      <p>以下のリンクをクリックして、新しいパスワードを設定してください。</p>
      <p><a href="${resetUrl}" style="padding:8px 16px;background:#1d4ed8;color:#fff;border-radius:4px;text-decoration:none;">パスワードをリセットする</a></p>
      <p>このリンクは24時間有効です。心当たりのない場合はこのメールを無視してください。</p>
    `,
  });
  if (error) {
    throw new Error(`パスワードリセットメール送信失敗: ${error.message}`);
  }
}

/**
 * 仮パスワード通知メールを送信する。
 * @param to 送信先メールアドレス
 * @param name スタッフ名（漢字）
 * @param tempPassword 仮パスワード（平文）
 */
export async function sendTempPasswordEmail(
  to: string,
  name: string,
  tempPassword: string
): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "【樫尾商店 勤怠管理】仮パスワードのご案内",
    html: `
      <h2>仮パスワードのご案内</h2>
      <p>${name} 様</p>
      <p>勤怠管理システムへのアクセス情報をお知らせします。</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 8px;font-weight:bold;">ログインURL</td><td style="padding:4px 8px;"><a href="${APP_URL}/login">${APP_URL}/login</a></td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">メールアドレス</td><td style="padding:4px 8px;">${to}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:bold;">仮パスワード</td><td style="padding:4px 8px;">${tempPassword}</td></tr>
      </table>
      <p style="color:#dc2626;font-weight:bold;">⚠️ 初回ログイン後、必ずパスワードを変更してください。</p>
      <p>このメールに心当たりがない場合は、管理者にお問い合わせください。</p>
    `,
  });
  if (error) {
    throw new Error(`仮パスワードメール送信失敗: ${error.message}`);
  }
}
