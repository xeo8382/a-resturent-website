import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { money } from "@/lib/order-rules";
import { AddButton } from "@/components/menu-browser";
import {
  customerPhoto,
  customerPhotoStyle,
  customerPhotoFrameStyle,
} from "@/lib/customer-photos";
import { Reveal } from "@/components/reveal";
import { Footer } from "@/components/footer";
export const dynamic = "force-dynamic";
export default async function FoodDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await db.menuItem.findUnique({
    where: { slug },
    include: { category: true },
  });
  if (!item) notFound();
  return (
    <>
      <main id="main" className="page-wrap">
        <Link href="/menu" className="text-link">
          ← Back to the menu
        </Link>
        <div className="food-detail">
          <Reveal className="detail-art">
            <div
              className="food-photo-frame"
              style={customerPhotoFrameStyle(item)}
            >
              <Image
                src={customerPhoto(item).src}
                alt={customerPhoto(item).alt}
                fill
                sizes="(max-width: 760px) 88vw, 48vw"
                style={customerPhotoStyle(item)}
                priority
              />
            </div>
          </Reveal>
          <Reveal>
            <p className="eyebrow">{item.category.name} · SAMPLE DISH</p>
            <h1>{item.name}</h1>
            <p className="detail-price">{money(item.price)}</p>
            <p>{item.description}</p>
            <p className="allergen-note">
              Allergens:{" "}
              {item.allergens.length
                ? item.allergens.join(", ")
                : "None listed"}
              . Our kitchen may handle other allergens; cross-contact is
              possible.
            </p>
            <p className="sample-note">
              Photography is serving inspiration; the sample dish may differ.
            </p>
            <AddButton item={item} />
            <Link className="text-link detail-bag" href="/cart">
              View your bag ↗
            </Link>
          </Reveal>
        </div>
      </main>
      <Footer />
    </>
  );
}
