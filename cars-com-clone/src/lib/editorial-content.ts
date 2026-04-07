export type EditorialArticle = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  readTime: string;
  image: string;
  takeaways: string[];
  body: Array<{
    heading: string;
    text: string;
  }>;
};

export const editorialArticles: EditorialArticle[] = [
  {
    slug: "best-used-cars-first-time-buyers",
    category: "Buyer tips",
    title: "Best used cars for first-time buyers",
    summary:
      "Look for easy-to-own models with strong reliability, simple controls, and a price point that leaves room for insurance and maintenance.",
    readTime: "4 min read",
    image:
      "https://img.freepik.com/premium-photo/cars-parking-lot-evening-light-sun_150893-219.jpg",
    takeaways: [
      "Choose a car with wide parts availability and a strong service network.",
      "Prioritize visibility, safety tech, and predictable running costs over extra power.",
      "Leave budget for registration, tires, and a post-purchase inspection.",
    ],
    body: [
      {
        heading: "Start with ownership, not features",
        text:
          "The best first car is one you can afford to keep, not just afford to buy. Compact sedans and small crossovers usually strike the best balance between price, efficiency, and ease of parking.",
      },
      {
        heading: "Keep the shortlist simple",
        text:
          "A short shortlist makes it easier to compare mileage, service history, and seller quality. Focus on cars with clean paperwork and consistent maintenance before chasing premium trims.",
      },
    ],
  },
  {
    slug: "used-car-checklist-before-you-buy",
    category: "Used cars",
    title: "What to check before buying a used car",
    summary:
      "A quick pre-purchase routine can save you from expensive surprises later, especially when the car looks good at first glance.",
    readTime: "5 min read",
    image:
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80",
    takeaways: [
      "Check service records, tire wear, warning lights, and uneven paint.",
      "Test the cold start, steering feel, brakes, and transmission behavior.",
      "Always verify paperwork before negotiating price.",
    ],
    body: [
      {
        heading: "Inspect beyond the photos",
        text:
          "Bring a simple checklist to the viewing. Panel gaps, mismatched paint, and damp odors can reveal previous damage or poor repairs that photos never show clearly.",
      },
      {
        heading: "Drive it in normal conditions",
        text:
          "A proper test drive should include stop-and-go traffic, braking, and a short stretch at speed. Listen for suspension noise, hesitation, and anything that feels inconsistent.",
      },
    ],
  },
  {
    slug: "hybrid-vs-gasoline-city-driving",
    category: "Fuel economy",
    title: "Hybrid vs. gasoline for city driving",
    summary:
      "If most of your week is slow traffic and short errands, a hybrid can feel noticeably cheaper and smoother in daily use.",
    readTime: "4 min read",
    image:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
    takeaways: [
      "Hybrids usually shine in heavy traffic where regenerative braking matters most.",
      "Gasoline models can still be the better pick if highway driving dominates your routine.",
      "Compare insurance, battery coverage, and resale before deciding.",
    ],
    body: [
      {
        heading: "Match the drivetrain to your commute",
        text:
          "Stop-start traffic rewards hybrid efficiency. If your driving is mostly open-road cruising, the fuel savings gap may shrink enough that a conventional engine still makes sense.",
      },
      {
        heading: "Look at the full ownership picture",
        text:
          "Fuel is only one part of the decision. Battery warranty, dealer support, and resale demand can make a bigger difference over a few years of ownership.",
      },
    ],
  },
  {
    slug: "estimate-total-ownership-cost",
    category: "Ownership",
    title: "How to estimate what a car will really cost",
    summary:
      "Sticker price is only the start. A smarter budget includes fuel, insurance, maintenance, registration, and future resale value.",
    readTime: "4 min read",
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80",
    takeaways: [
      "Break the cost into monthly items so the total feels realistic.",
      "Depreciation can matter more than fuel on newer vehicles.",
      "Use the same time horizon when comparing two cars.",
    ],
    body: [
      {
        heading: "Use a three-year view",
        text:
          "Comparing cars over the same ownership window makes it easier to see which one stays affordable. Include expected mileage and the type of driving you do most often.",
      },
      {
        heading: "Budget for the first year separately",
        text:
          "Insurance, taxes, detailing, and small repairs often hit early. Keeping a first-year buffer helps you avoid turning a good deal into a stressful purchase.",
      },
    ],
  },
  {
    slug: "when-buying-new-makes-sense",
    category: "Budget guide",
    title: "When buying new makes more sense",
    summary:
      "A new car is not always the cheaper choice, but it can be the better one when financing, warranty, and resale all line up.",
    readTime: "3 min read",
    image:
      "https://www.cashforcars.com/content/uploads/2019/02/man-handing-woman-car-keys-700x460-main-min.jpg",
    takeaways: [
      "Low financing rates can narrow the gap between new and lightly used.",
      "Factory warranty matters more if you want predictable ownership costs.",
      "High-demand used models can sometimes be priced too close to new.",
    ],
    body: [
      {
        heading: "Watch the used-market spread",
        text:
          "If one- or two-year-old examples are priced very close to new, the extra warranty and cleaner history of a new car may be worth the jump.",
      },
      {
        heading: "Be honest about risk tolerance",
        text:
          "Some buyers prefer the certainty of a fresh warranty and known service history. Others would rather take a lower purchase price and accept a bit more uncertainty.",
      },
    ],
  },
  {
    slug: "signs-used-car-may-cost-more-later",
    category: "Ownership",
    title: "Signs a used car may cost more later",
    summary:
      "A low asking price can hide bigger costs ahead, especially when the car shows neglected maintenance or unclear history.",
    readTime: "4 min read",
    image:
      "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80",
    takeaways: [
      "Incomplete history and uneven maintenance are major warning signs.",
      "Cheap tires, rough idle, and warning lights usually point to deferred spending.",
      "Walk away when the seller cannot explain key repairs or ownership history.",
    ],
    body: [
      {
        heading: "Cheap now can mean expensive soon",
        text:
          "A bargain only works if the car is fundamentally sound. Once you factor in tires, fluids, suspension, and electrical repairs, the cheapest listing can quickly become the most expensive one to keep.",
      },
      {
        heading: "Trust the seller pattern",
        text:
          "Clear records, straightforward answers, and consistent maintenance often matter more than cosmetic shine. Good sellers make it easy to understand what you are buying.",
      },
    ],
  },
];

export function getEditorialArticleBySlug(slug: string) {
  return editorialArticles.find((article) => article.slug === slug) ?? null;
}

export function getRelatedEditorialArticles(slug: string, limit = 3) {
  const current = getEditorialArticleBySlug(slug);
  if (!current) return editorialArticles.slice(0, limit);

  const related = editorialArticles.filter(
    (article) => article.slug !== slug && article.category === current.category
  );

  const fallback = editorialArticles.filter((article) => article.slug !== slug);
  return [...related, ...fallback].slice(0, limit);
}
