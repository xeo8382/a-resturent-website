// Presentation-only mapping. Database images, API responses and POS are unchanged.
const photos: Record<string, { src: string; alt: string; position?: string }> =
  {
    "fire-roasted-chicken": {
      src: "/photos/chicken.jpg",
      alt: "Golden chicken in a cast-iron skillet with creamy herbs; serving inspiration",
    },
    "ember-beef-bowl": {
      src: "/photos/steak.jpg",
      alt: "Seared beef with seasonal vegetables; serving inspiration",
      position: "16% center",
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
}) {
  return photos[item.slug] ?? { src: item.image, alt: item.name };
}
