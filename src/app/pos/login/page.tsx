import Link from "next/link";
import { redirect } from "next/navigation";
import { Flame } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Staff sign in" };
export default async function LoginPage() {
  if (await currentUser()) redirect("/pos/orders");
  return (
    <main id="main" className="login-page">
      <div className="login-card">
        <Link href="/" className="brand">
          <Flame />
          <span>
            ember & table<small>BEHIND THE FLAME</small>
          </span>
        </Link>
        <p className="eyebrow">THE STAFF ENTRANCE</p>
        <h1>
          Welcome <em>back.</em>
        </h1>
        <p>Good service starts here.</p>
        <LoginForm />
        <Link href="/" className="text-link">
          ← Back to the restaurant
        </Link>
      </div>
    </main>
  );
}
