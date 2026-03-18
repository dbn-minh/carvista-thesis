import type React from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const HeroSection = () => {
  return (
    <section className="relative w-full bg-cars-primary text-white">
      {/* Background Image with Purple Overlay */}
      <div className="relative w-full min-h-[350px] md:min-h-[500px] overflow-hidden">
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-cars-primary via-cars-primary/90 to-cars-accent/60" />
        <Image
          src="https://ext.same-assets.com/569242764/3049107266.png"
          alt="Featured Cars"
          fill
          className="object-cover object-right"
          priority
        />

        {/* Hero Content */}
        <div className="container-cars relative z-20 flex flex-col h-full pt-12 md:pt-20">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-5xl font-apercu-bold mb-4">
              2025 Best Value Awards
            </h1>
            <p className="text-lg md:text-xl mb-8">
              In the wake of auto tariffs, find new cars with the most bang for the buck.
            </p>

            {/* Search Form */}
            <div className="bg-white p-4 rounded-md shadow-md">
              <div className="flex items-center gap-2 flex-col sm:flex-row">
                <div className="w-full sm:w-3/4">
                  <Input
                    type="text"
                    placeholder="Find cars for sale"
                    className="border-cars-gray h-12"
                  />
                </div>
                <Button
                  className="w-full sm:w-1/4 bg-cars-accent hover:bg-cars-accent/90 text-white h-12"
                >
                  Search
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-4">
                <SearchOption label="Shop cars for sale" href="/shopping/" />
                <SearchOption label="Sell your car" href="/sell/" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

type SearchOptionProps = {
  label: string;
  href: string;
};

const SearchOption: React.FC<SearchOptionProps> = ({ label, href }) => {
  return (
    <a
      href={href}
      className="text-cars-primary text-sm font-apercu-regular hover:text-cars-accent transition-colors"
    >
      {label}
    </a>
  );
};

export default HeroSection;
