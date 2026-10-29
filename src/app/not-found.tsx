import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="page-wrap empty-state">
      <p className="eyebrow">404 · A MISSING INGREDIENT</p>
      <h1>This plate isn’t on the menu.</h1>
      <Link className="button" href="/menu">
        Explore the menu ↗
      </Link>
    </main>
  );
}
