"use client";

import Image from "next/image";
import Link from "next/link";
import { editorialArticles } from "@/lib/editorial-content";

const homeArticles = editorialArticles.slice(0, 5);

export default function NewsSection() {
  const [featuredArticle, ...secondaryArticles] = homeArticles;

  return (
    <section className="py-10">
      <div className="container-cars">
        <div className="section-shell p-6 md:p-8">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                News &amp; Tips
              </p>
              <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">
                Fresh advice for smarter car shopping
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Practical buying guides, ownership tips, and side-by-side advice you can use before making a move.
              </p>
            </div>

            <Link
              href="/tips"
              className="inline-flex rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
            >
              View all articles
            </Link>
          </div>

          <div className="space-y-5">
            <Link
              href={`/tips/${featuredArticle.slug}`}
              className="group overflow-hidden rounded-[30px] border border-cars-gray-light/80 bg-white transition-all hover:-translate-y-1 hover:border-cars-accent/25 hover:shadow-[0_18px_42px_rgba(15,45,98,0.12)]"
            >
              <div className="grid gap-0 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="relative h-72 overflow-hidden bg-cars-off-white xl:h-full xl:min-h-[360px]">
                  <Image
                    src={featuredArticle.image}
                    alt={featuredArticle.title}
                    fill
                    sizes="(max-width: 1280px) 100vw, 55vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="flex h-full flex-col p-6 md:p-7">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    <span>{featuredArticle.category}</span>
                    <span className="text-cars-gray">{featuredArticle.readTime}</span>
                  </div>
                  <h3 className="mt-3 max-w-2xl text-2xl font-apercu-bold leading-tight text-cars-primary md:text-3xl">
                    {featuredArticle.title}
                  </h3>
                  <p className="mt-4 max-w-2xl line-clamp-3 text-sm leading-7 text-cars-gray md:text-base">
                    {featuredArticle.summary}
                  </p>
                  <span className="mt-auto inline-flex pt-6 text-sm font-semibold text-cars-primary transition-colors group-hover:text-cars-accent">
                    Read more
                  </span>
                </div>
              </div>
            </Link>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {secondaryArticles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/tips/${article.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-cars-gray-light/80 bg-white transition-all hover:-translate-y-1 hover:border-cars-accent/25 hover:shadow-[0_18px_42px_rgba(15,45,98,0.12)]"
                >
                  <div className="relative h-52 overflow-hidden bg-cars-off-white">
                    <Image
                      src={article.image}
                      alt={article.title}
                      fill
                      sizes="(max-width: 1280px) 50vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-cars-accent">
                      <span>{article.category}</span>
                      <span className="text-cars-gray">{article.readTime}</span>
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-lg font-apercu-bold leading-7 text-cars-primary">
                      {article.title}
                    </h3>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-cars-gray">
                      {article.summary}
                    </p>
                    <span className="mt-auto inline-flex pt-5 text-sm font-semibold text-cars-primary transition-colors group-hover:text-cars-accent">
                      Read more
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
