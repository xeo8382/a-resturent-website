import { MenuBrowser } from "@/components/menu-browser";
import { Reveal } from "@/components/reveal";
import { Footer } from "@/components/footer";
export const metadata = { title: "The menu" };
export default function MenuPage() {
  return (
    <>
      <main id="main" className="page-wrap">
        <Reveal className="page-heading menu-page-heading">
          <p className="eyebrow">THE EMBER & TABLE COLLECTION</p>
          <h1>
            Follow your <em>appetite.</em>
          </h1>
          <p>
            From our fire to your table. Find a favourite, or meet a new one.
          </p>
          <p className="sample-note">
            Sample menu · Serving-inspiration photography · Prices in BDT. Tell
            us about allergies before ordering.
          </p>
        </Reveal>
        <MenuBrowser />
      </main>
      <Footer />
    </>
  );
}
