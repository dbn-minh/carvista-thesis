import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

const featuredEVs = [
  {
    id: 1,
    name: "Tesla Model 3",
    image: "https://ext.same-assets.com/569242764/3907242556.png",
    link: "/shopping/all/tesla-model_3/",
  },
  {
    id: 2,
    name: "Tesla Model S",
    image: "https://ext.same-assets.com/569242764/2920290074.png",
    link: "/shopping/all/tesla-model_s/",
  },
  {
    id: 3,
    name: "Nissan Leaf",
    image: "https://ext.same-assets.com/569242764/2852269482.png",
    link: "/shopping/all/nissan-leaf/",
  },
  {
    id: 4,
    name: "Tesla Model Y",
    image: "https://ext.same-assets.com/569242764/1860271599.png",
    link: "/shopping/all/tesla-model_y/",
  },
  {
    id: 5,
    name: "Ford Mustang Mach-E",
    image: "https://ext.same-assets.com/569242764/814001789.png",
    link: "/shopping/all/ford-mustang_mach_e/",
  },
  {
    id: 6,
    name: "Ford F-150 Lightning",
    image: "https://ext.same-assets.com/569242764/425955460.png",
    link: "/shopping/all/ford-f_150_lightning/",
  },
];

const FeaturedEVs = () => {
  return (
    <section className="py-10">
      <div className="container-cars">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-apercu-bold text-cars-primary">
            All new EVs
          </h2>
          <Link
            href="/new-cars/?type=electric-vehicle"
            className="text-cars-accent hover:underline text-sm"
          >
            Shop new cars
          </Link>
        </div>

        <p className="text-cars-primary mb-6">
          Experience the best way to search new cars
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {featuredEVs.map((ev) => (
            <EVCard
              key={ev.id}
              name={ev.name}
              image={ev.image}
              link={ev.link}
            />
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/shopping/all/electric/"
            className="text-cars-primary border border-cars-primary rounded-md px-4 py-2 inline-block
                     hover:bg-cars-primary hover:text-white transition-colors"
          >
            See more electric cars
          </Link>
        </div>
      </div>
    </section>
  );
};

type EVCardProps = {
  name: string;
  image: string;
  link: string;
};

const EVCard: React.FC<EVCardProps> = ({ name, image, link }) => {
  return (
    <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow">
      <CardContent className="p-0">
        <div className="flex flex-col">
          <div className="relative h-40 w-full bg-gray-100">
            <Image src={image} alt={name} fill className="object-contain" />
          </div>
          <div className="p-4">
            <h3 className="text-cars-primary font-apercu-bold text-lg mb-2">
              {name}
            </h3>
            <Link
              href={link}
              className="text-cars-primary text-sm hover:text-cars-accent transition-colors"
            >
              Shop now
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeaturedEVs;
