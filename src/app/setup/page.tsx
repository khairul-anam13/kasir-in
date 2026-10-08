import { redirect } from "next/navigation";
import { Icon } from "@/components/icons";
import { sql } from "@/lib/db";
import { Wizard } from "./wizard";

export const metadata = { title: "Setup awal" };

export default async function SetupPage() {
  const [b] = await sql`select 1 from business`;
  if (b) redirect("/masuk");
  return (
    <main className="center">
      <div className="wizard">
        <div className="brand-lg"><Icon name="logo" /> Kasir-in</div>
        <Wizard />
      </div>
    </main>
  );
}
