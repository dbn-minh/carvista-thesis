import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

const newsArticles = [
  {
    id: 1,
    title: "Why Is the Battery Light On?",
    image: "https://ext.same-assets.com/569242764/2708255373.webp",
    link: "/articles/why-is-the-battery-light-on-1420663031640/",
    featured: true,
  },
  {
    id: 2,
    title:
      "Slate Reveals Modular Electric Pickup Truck, SUV Priced Under $20,000 After Tax Credits",
    image: "https://ext.same-assets.com/569242764/3296848294.webp",
    link: "/articles/slate-reveals-modular-electric-pickup-truck-suv-priced-under-20000-after-tax-credits-508448/",
    featured: false,
  },
  {
    id: 3,
    title: "Kia EVs Get Access to Tesla Supercharger Network",
    image: "https://ext.same-assets.com/569242764/1361286067.webp",
    link: "/articles/kia-evs-get-access-to-tesla-supercharger-network-508469/",
    featured: false,
  },
  {
    id: 4,
    title:
      "New 2025 Audi Q5 and Q5 Sportback: Daring New Look for the Brands Bestseller",
    image: "https://ext.same-assets.com/569242764/1269782033.webp",
    link: "/articles/new-2025-audi-q5-and-q5-sportback-daring-new-look-for-the-brands-bestseller-508083/",
    featured: false,
  },
];

const NewsSection = () => {
  return (
    <section className="py-10 bg-cars-off-white">
      <div className="container-cars">
        <h2 className="text-2xl font-apercu-bold text-cars-primary mb-6">
          News & reviews
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {newsArticles.map((article) => (
            <NewsCard
              key={article.id}
              title={article.title}
              image={article.image}
              link={article.link}
              featured={article.featured}
            />
          ))}
        </div>

        <div className="mt-10">
          <h3 className="font-apercu-bold text-cars-primary mb-4">
            Trending near you
          </h3>
          <ol className="list-decimal list-inside space-y-3 pl-4">
            <li>
              <Link
                href="/articles/teslalternatives-what-should-you-buy-if-youre-tired-of-your-tesla-507404/"
                className="text-cars-primary hover:text-cars-accent transition-colors"
              >
                Teslalternatives: What Should You Buy if You're Tired of Your
                Tesla?
              </Link>
            </li>
            <li>
              <Link
                href="/articles/what-are-the-best-used-cars-for-20000-437804/"
                className="text-cars-primary hover:text-cars-accent transition-colors"
              >
                What Are the Best Used Cars for $20,000?
              </Link>
            </li>
            <li>
              <Link
                href="/articles/2025-toyota-sienna-gains-new-vacuum-fridge-and-remote-rear-seat-alert-489510/"
                className="text-cars-primary hover:text-cars-accent transition-colors"
              >
                2025 Toyota Sienna Gains New Vacuum, Fridge and Remote Rear-Seat
                Alert
              </Link>
            </li>
            <li>
              <Link
                href="/articles/can-the-2024-honda-ridgeline-trailsport-really-go-off-road-486634/"
                className="text-cars-primary hover:text-cars-accent transition-colors"
              >
                Can the 2024 Honda Ridgeline TrailSport Really Go Off-Road?
              </Link>
            </li>
            <li>
              <Link
                href="/articles/here-are-the-10-cheapest-new-cars-you-can-buy-right-now-421309/"
                className="text-cars-primary hover:text-cars-accent transition-colors"
              >
                Here Are the 10 Cheapest New Cars You Can Buy Right Now
              </Link>
            </li>
          </ol>

          <div className="mt-6">
            <Link
              href="/news/"
              className="text-cars-primary text-sm hover:text-cars-accent transition-colors"
            >
              See all news
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

type NewsCardProps = {
  title: string;
  image: string;
  link: string;
  featured: boolean;
};

const NewsCard: React.FC<NewsCardProps> = ({
  title,
  image,
  link,
  featured,
}) => {
  return (
    <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow h-full">
      <CardContent className="p-0 h-full">
        <Link href={link} className="flex flex-col h-full">
          <div className="relative h-48 w-full">
            <Image src={image} alt={title} fill className="object-cover" />
            {featured && (
              <div className="absolute top-2 left-2 bg-cars-primary text-white text-xs px-2 py-1 rounded">
                Featured
              </div>
            )}
          </div>
          <div className="p-4 flex-grow flex flex-col">
            <h3 className="text-cars-primary font-apercu-bold text-lg">
              {title}
            </h3>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
};

export default NewsSection;
