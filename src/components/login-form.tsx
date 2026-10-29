"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      router.push("/pos/orders");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        Email
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={200}
          required
        />
      </label>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <button className="button wide" disabled={busy}>
        {busy ? "Signing in…" : "Open the kitchen ↗"}
      </button>
      <p className="sample-note">
        Staff access only. Ask your administrator for an account. Sessions
        expire after 8 hours.
      </p>
    </form>
  );
}
