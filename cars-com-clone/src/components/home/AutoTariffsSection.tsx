import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const AutoTariffsSection = () => {
  return (
    <section className="py-12 border-t border-cars-gray-light">
      <div className="container-cars">
        <div className="flex flex-col md:flex-row items-center">
          <div className="w-full md:w-1/2 md:pr-12 mb-8 md:mb-0">
            <div className="flex items-center mb-2">
              <span className="text-xs text-cars-gray bg-cars-off-white px-2 py-1 rounded-sm">
                Cars.com news
              </span>
            </div>
            <h2 className="text-2xl font-apercu-bold text-cars-primary mb-4">
              Auto tariffs explained
            </h2>
            <p className="text-cars-primary mb-6">
              How will automotive tariffs affect your next car purchase? Our
              experts explain everything you need to know.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                variant="outline"
                asChild
                className="border-cars-primary text-cars-primary hover:bg-cars-primary hover:text-white"
              >
                <Link href="/articles/category/auto-tariff-news/">
                  See all tariff news
                </Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="border-cars-primary text-cars-primary hover:bg-cars-primary hover:text-white"
              >
                <Link href="/shopping/american-made-index/">
                  Shop American-made cars
                </Link>
              </Button>
            </div>
          </div>
          <div className="w-full md:w-1/2 relative">
            <Image
              src="https://ext.same-assets.com/569242764/2943101928.webp"
              alt="Auto tariffs explained"
              width={600}
              height={400}
              className="rounded-lg shadow-md"
            />
            {/* Decorative element */}
            <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-cars-accent rounded-full hidden md:block" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AutoTariffsSection;
