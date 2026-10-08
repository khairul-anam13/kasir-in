import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { getUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { loginAction } from "./actions";

export const metadata = { title: "Masuk" };

export default async function LoginPage() {
  const [b] = await sql`select name from business`;
  if (!b) redirect("/setup");
  if (await getUser()) redirect("/kasir");
  return (
    <main className="center">
      <div className="auth">
        <div className="brand-lg"><Icon name="logo" /> Kasir-in</div>
        <div>
          <h1>Masuk</h1>
          <p className="muted">{b.name}</p>
        </div>
        <div className="card">
          <ActionForm action={loginAction} submit="Masuk" block>
            <label className="f"><span>Username</span>
              <input className="input" name="username" autoComplete="username" autoCapitalize="none" autoFocus required />
            </label>
            <label className="f"><span>Password</span>
              <input className="input" name="password" type="password" autoComplete="current-password" required />
            </label>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
