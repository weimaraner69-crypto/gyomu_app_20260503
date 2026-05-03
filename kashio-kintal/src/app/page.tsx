// ルートページ — 認証状態に応じてリダイレクトする
import { redirect } from "next/navigation";
import { getCurrentUser, getDefaultPath } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    redirect(getDefaultPath(user.role));
  }
  redirect("/login");
}
