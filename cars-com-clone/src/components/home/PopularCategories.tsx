import type React from "react";
import Link from "next/link";

const categories = [
  { name: "Electric", href: "/shopping/electric/" },
  { name: "SUV", href: "/shopping/suv/" },
  { name: "Sedan", href: "/shopping/sedan/" },
  { name: "Pickup Truck", href: "/shopping/truck/" },
  { name: "Luxury", href: "/shopping/luxury/" },
  { name: "Crossover", href: "/shopping/crossover/" },
  { name: "Hybrid", href: "/shopping/hybrid/" },
  { name: "Diesel", href: "/shopping/diesel/" },
  { name: "Coupe", href: "/shopping/coupe/" },
  { name: "Hatchback", href: "/shopping/hatchback/" },
  { name: "Wagon", href: "/shopping/wagon/" },
  { name: "Convertible", href: "/shopping/convertible/" },
  { name: "Minivan", href: "/shopping/minivan/" },
  { name: "Plug-in Hybrid", href: "/shopping/plug-in-hybrid/" },
  { name: "Van", href: "/shopping/van/" },
];

const PopularCategories = () => {
  return (
    <section className="py-8 bg-cars-off-white">
      <div className="container-cars">
        <h2 className="text-2xl font-apercu-bold text-cars-primary mb-6">
          Popular categories
        </h2>

        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <CategoryButton
              key={category.name}
              name={category.name}
              href={category.href}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

type CategoryButtonProps = {
  name: string;
  href: string;
};

const CategoryButton: React.FC<CategoryButtonProps> = ({ name, href }) => {
  return (
    <Link
      href={href}
      className="px-4 py-2 bg-white text-cars-primary border border-cars-gray-light rounded-full
                text-sm hover:bg-cars-accent hover:text-white hover:border-cars-accent transition-colors"
    >
      {name}
    </Link>
  );
};

export default PopularCategories;
