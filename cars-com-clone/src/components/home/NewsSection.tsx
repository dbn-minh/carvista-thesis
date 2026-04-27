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
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8fb4ff]">
                News &amp; Tips
              </p>
              <h2 className="editorial-heading mt-2 text-2xl sm:text-3xl">
                Fresh advice for smarter car shopping
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Practical buying guides, ownership tips, and side-by-side advice you can use
                before making a move.
              </p>
            </div>

            <Link
              href="/tips"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10 sm:w-auto"
            >
              View all articles
            </Link>
          </div>

          <div className="space-y-5">
            <Link
              href={`/tips/${featuredArticle.slug}`}
              className="group overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,36,0.98),rgba(10,14,20,0.98))] transition-all hover:-translate-y-1 hover:border-[#8fb4ff]/30 hover:shadow-[0_22px_54px_rgba(0,0,0,0.32)]"
            >
              <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="relative h-60 overflow-hidden bg-[#0c1119] sm:h-72 lg:h-full lg:min-h-[360px]">
                  <Image
                    src={featuredArticle.image}
                    alt={featuredArticle.title}
                    fill
                    sizes="(max-width: 1280px) 100vw, 55vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="flex h-full flex-col p-6 md:p-7">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8fb4ff]">
                    <span>{featuredArticle.category}</span>
                    <span className="text-slate-400">{featuredArticle.readTime}</span>
                  </div>
                  <h3 className="mt-3 max-w-2xl text-xl font-apercu-bold leading-tight text-slate-50 sm:text-2xl md:text-3xl">
                    {featuredArticle.title}
                  </h3>
                  <p className="mt-4 max-w-2xl line-clamp-3 text-sm leading-7 text-slate-300 md:text-base">
                    {featuredArticle.summary}
                  </p>
                  <span className="mt-auto inline-flex pt-6 text-sm font-semibold text-slate-100 transition-colors group-hover:text-[#7de2ff]">
                    Read more
                  </span>
                </div>
              </div>
            </Link>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {secondaryArticles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/tips/${article.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,36,0.98),rgba(10,14,20,0.98))] transition-all hover:-translate-y-1 hover:border-[#8fb4ff]/30 hover:shadow-[0_22px_54px_rgba(0,0,0,0.32)]"
                >
                  <div className="relative h-52 overflow-hidden bg-[#0c1119]">
                    <Image
                      src={article.image}
                      alt={article.title}
                      fill
                      sizes="(max-width: 1280px) 50vw, 25vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fb4ff]">
                      <span>{article.category}</span>
                      <span className="text-slate-400">{article.readTime}</span>
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-lg font-apercu-bold leading-7 text-slate-50">
                      {article.title}
                    </h3>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">
                      {article.summary}
                    </p>
                    <span className="mt-auto inline-flex pt-5 text-sm font-semibold text-slate-100 transition-colors group-hover:text-[#7de2ff]">
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
