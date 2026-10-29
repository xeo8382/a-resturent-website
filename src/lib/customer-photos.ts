// Presentation-only mapping. Database images, API responses and POS are unchanged.
import type { CSSProperties } from "react";

type CustomerPhoto = {
  src: string;
  alt: string;
  position?: string;
  frameScale?: number;
};
const photos: Record<string, CustomerPhoto> = {
  "fire-roasted-chicken": {
    src: "/photos/chicken.jpg",
    alt: "Golden chicken in a cast-iron skillet with creamy herbs; serving inspiration",
  },
  "ember-beef-bowl": {
    src: "/photos/steak.jpg",
    alt: "Seared beef with seasonal vegetables; serving inspiration",
    position: "left top",
    frameScale: 1.9,
  },
  "garden-harvest": {
    src: "/photos/harvest.jpg",
    alt: "Chickpea and potato curry with rice and fresh herbs; serving inspiration",
    position: "center 60%",
  },
  "crispy-potatoes": {
    src: "/photos/potatoes.jpg",
    alt: "Crisp potato stacks with poached eggs and herbs; serving inspiration",
    position: "center 65%",
  },
  "burrata-tomatoes": {
    src: "/photos/vegetables.jpg",
    alt: "A colourful spread of vegetables, bread and warm cheese; serving inspiration",
  },
  "dark-chocolate": {
    src: "/photos/chocolate.jpg",
    alt: "Rich chocolate dessert; serving inspiration",
  },
};
export function customerPhoto(item: {
  slug: string;
  image: string;
  name: string;
}): CustomerPhoto {
  return photos[item.slug] ?? { src: item.image, alt: item.name };
}

// Keep the image's fill sizing intact; crop with a separate static frame.
export function customerPhotoStyle(item: {
  slug: string;
  image: string;
  name: string;
}): CSSProperties {
  return { objectPosition: customerPhoto(item).position };
}
export function customerPhotoFrameStyle(item: {
  slug: string;
  image: string;
  name: string;
}): CSSProperties {
  const scale = customerPhoto(item).frameScale ?? 1;
  return { width: `${scale * 100}%`, height: `${scale * 100}%` };
}
