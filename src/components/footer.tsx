import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Link href="/" className="footer-brand">
          ember & table<span>Menu, orders & reservations</span>
        </Link>
      </div>
      <div>
        <span className="eyebrow">A LITTLE MORE</span>
        <Link href="/menu">
          Explore the menu <ArrowUpRight size={11} />
        </Link>
        <Link href="/reservations">
          Find your table <ArrowUpRight size={11} />
        </Link>
        <Link href="/contact">
          Visit & contact <ArrowUpRight size={11} />
        </Link>
      </div>
      <div>
        <span className="eyebrow">THE FINE PRINT</span>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
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
