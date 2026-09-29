// Reference copy from the supplied About Us screenshot, not live store claims.
export const aboutSections = [
  {
    id: "our-story", title: "A Family That Keeps On Growing", dark: true,
    image: "showroom.webp", alt: "Computer showroom with laptops and accessories", width: 471, height: 489,
    paragraphs: [
      "We always aim to please the home market, supplying great computers and hardware at great prices to non-corporate customers, through our large Melbourne CBD showroom and our online store.",
      "Shop management approach fosters a strong customer service focus in our staff. We prefer to cultivate long-term client relationships rather than achieve quick sales, demonstrated in the measure of our long-term success.",
    ],
  },
  {
    id: "our-shop", title: "Shop.com", dark: false,
    image: "keyboard.webp", alt: "Alienware mechanical gaming keyboard", width: 777, height: 557,
    icon: { name: "logo-white", width: 25, height: 30 },
    paragraphs: ["Shop.com is a proudly Australian owned, Melbourne based supplier of I.T. goods and services, operating since 1991. Our client base encompasses individuals, small business, corporate and government organisations. We provide complete business IT solutions, centred on high quality hardware and exceptional customer service."],
  },
  {
    id: "safe-hands", title: "Now You’re In Safe Hands", dark: true,
    image: "safe-hands.webp", alt: "Black desktop PC with green liquid cooling", width: 451, height: 549,
    icon: { name: "hearth", width: 17, height: 15 },
    paragraphs: [
      "Experience a 40% boost in computing from last generation. MSI Desktop equips the 10th Gen. Intel® Core™ i7 processor with the upmost computing power to bring you an unparalleled gaming experience.",
      "*Performance compared to i7-9700. Specs varies by model.",
    ],
  },
  {
    id: "quality", title: "The Highest Quality of Products", dark: false,
    image: "quality.webp", alt: "White desktop PC with RGB fans and a glass side panel", width: 504, height: 558,
    icon: { name: "star", width: 20, height: 19 },
    paragraphs: ["We guarantee the highest quality of the products we sell. Several decades of successful operation and millions of happy customers let us feel certain about that. Besides, all items we sell pass thorough quality control, so no characteristics mismatch can escape the eye of our professionals."],
  },
  {
    id: "delivery", title: "We Deliver to Any Regions", dark: true,
    image: "delivery.webp", alt: "Silver and black performance desktop computer", width: 409, height: 544,
    icon: { name: "truck", width: 21, height: 16 },
    paragraphs: ["We deliver our goods all across Australia. No matter where you live, your order will be shipped in time and delivered right to your door or to any other location you have stated. The packages are handled with utmost care, so the ordered products will be handed to you safe and sound, just like you expect them to be."],
  },
] as const;
