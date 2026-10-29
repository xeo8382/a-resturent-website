"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
type Item = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  description: string;
  categoryId: string;
  allergens: string[];
};
export function AdminPanel({
  items,
  canCreateStaff,
  categories,
}: {
  items: Item[];
  canCreateStaff: boolean;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
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
          name: form.get("name"),
          description: form.get("description"),
          categoryId: form.get("categoryId"),
          allergens: String(form.get("allergens") || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage(`${item.name} saved.`);
      router.refresh();
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
            <div className="menu-content-fields">
              <label>
                Dish name
                <input
                  name="name"
                  aria-label={`Name for ${item.name}`}
                  defaultValue={item.name}
                  minLength={2}
                  maxLength={80}
                  required
                />
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  defaultValue={item.description}
                  minLength={10}
                  maxLength={600}
                  required
                />
              </label>
              <label>
                Allergens (comma separated)
                <input
                  name="allergens"
                  defaultValue={item.allergens.join(", ")}
                />
              </label>
            </div>
            <label>
              Category
              <select name="categoryId" defaultValue={item.categoryId}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
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
      <section className="menu-create">
        <h2>Add menu item</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const element = e.currentTarget;
            const form = new FormData(element);
            setBusy(true);
            setMessage("");
            try {
              const r = await fetch("/api/admin/menu", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: form.get("name"),
                  slug: form.get("slug"),
                  description: form.get("description"),
                  categoryId: form.get("categoryId"),
                  price: Math.round(Number(form.get("price")) * 100),
                  available: form.get("available") === "on",
                  allergens: String(form.get("allergens") || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }),
              });
              const data = await r.json();
              if (!r.ok) throw new Error(data.error);
              element.reset();
              setMessage("Menu item created with a placeholder illustration.");
              router.refresh();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Creation failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Name
            <input name="name" minLength={2} maxLength={80} required />
          </label>
          <label>
            URL slug
            <input
              name="slug"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              minLength={2}
              maxLength={100}
              placeholder="new-house-favourite"
              required
            />
          </label>
          <label className="span-two">
            Description
            <textarea
              name="description"
              minLength={10}
              maxLength={600}
              required
            />
          </label>
          <label>
            Category
            <select name="categoryId" required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Price (BDT)
            <input
              type="number"
              name="price"
              min="1"
              max="100000"
              step="0.01"
              required
            />
          </label>
          <label>
            Allergens (comma separated)
            <input name="allergens" />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="available" defaultChecked /> Available
          </label>
          <button className="button" disabled={busy}>
            Create menu item
          </button>
        </form>
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
