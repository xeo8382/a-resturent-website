"use client";
import { useState } from "react";
type Item = { id: string; name: string; price: number; available: boolean };
export function AdminPanel({
  items,
  canCreateStaff,
}: {
  items: Item[];
  canCreateStaff: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function update(event: React.FormEvent<HTMLFormElement>, item: Item) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const r = await fetch("/api/admin/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          price: Math.round(Number(form.get("price")) * 100),
          available: form.get("available") === "on",
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage(`${item.name} saved.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    setBusy(true);
    setMessage("");
    const form = new FormData(element);
    try {
      const r = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage("Staff account created.");
      element.reset();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Creation failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="admin-menu">
        <h2>Menu pricing & availability</h2>
        {items.map((item) => (
          <form key={item.id} onSubmit={(e) => void update(e, item)}>
            <strong>{item.name}</strong>
            <label>
              Price (BDT)
              <input
                name="price"
                type="number"
                min="1"
                max="100000"
                step="0.01"
                defaultValue={item.price / 100}
                required
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="available"
                defaultChecked={item.available}
              />{" "}
              Available
            </label>
            <button className="button small" disabled={busy}>
              Save
            </button>
          </form>
        ))}
      </section>
      {canCreateStaff && (
        <section className="admin-staff">
          <h2>Create staff account</h2>
          <form onSubmit={(e) => void create(e)} className="form-panel">
            <label>
              Name
              <input name="name" minLength={2} maxLength={80} required />
            </label>
            <label>
              Email
              <input name="email" type="email" maxLength={254} required />
            </label>
            <label>
              Initial password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={200}
                required
              />
            </label>
            <label>
              Role
              <select name="role">
                <option value="STAFF">Service staff</option>
                <option value="KITCHEN">Kitchen</option>
                <option value="MANAGER">Manager</option>
              </select>
            </label>
            <button className="button" disabled={busy}>
              Create account
            </button>
          </form>
        </section>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </>
  );
}
