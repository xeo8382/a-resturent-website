import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Link href="/" className="footer-brand">
          ember & table<span>Good food. Better company.</span>
        </Link>
      </div>
      <div>
        <span className="eyebrow">A LITTLE MORE</span>
        <Link href="/menu">
          Explore the menu <ArrowUpRight size={11} />
        </Link>
        <Link href="/pos/login">
          Staff sign in <ArrowUpRight size={11} />
        </Link>
      </div>
      <div>
        <span className="eyebrow">THE FINE PRINT</span>
        <p>
          Concept restaurant · Sample menu & pricing
          <br />
          Serving-inspiration photography · BDT prices
        </p>
        <a href="/photos/CREDITS.txt" className="photo-credits-link">
          Photo & font credits <ArrowUpRight size={10} />
        </a>
        <small>© {new Date().getFullYear()} Ember & Table</small>
      </div>
    </footer>
  );
}
