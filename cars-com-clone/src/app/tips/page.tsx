import Image from "next/image";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { editorialArticles } from "@/lib/editorial-content";

const [featuredArticle, ...articleList] = editorialArticles;

export default function TipsPage() {
  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden border border-cars-primary/10 bg-[linear-gradient(135deg,rgba(15,45,98,0.96),rgba(27,76,160,0.92),rgba(95,150,255,0.72))] p-6 text-white md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">
            News &amp; Tips
          </p>
          <h1 className="mt-2 max-w-3xl text-4xl font-apercu-bold leading-tight md:text-5xl">
            Car buying advice you can actually use
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/85 md:text-base">
            Browse quick reads on used-car checks, ownership costs, city-friendly hybrids, and the questions worth asking before you buy.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/tips/${featuredArticle.slug}`}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-cars-primary"
            >
              Read the featured guide
            </Link>
            <Link
              href="/listings"
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Browse listings
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Featured guide
              </p>
              <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">
                Start with the guide most buyers need
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-cars-gray">
              Save the long read for the article page. Here you can scan quickly, then open the guide that matches your next decision.
            </p>
          </div>

          <Link
            href={`/tips/${featuredArticle.slug}`}
            className="group overflow-hidden rounded-[30px] border border-cars-gray-light/80 bg-white transition-all hover:-translate-y-1 hover:border-cars-accent/25 hover:shadow-[0_18px_42px_rgba(15,45,98,0.12)]"
          >
            <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="relative h-72 overflow-hidden bg-cars-off-white lg:h-full lg:min-h-[360px]">
                <Image
                  src={featuredArticle.image}
                  alt={featuredArticle.title}
                  fill
                  sizes="(max-width: 1280px) 100vw, 55vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
              <div className="flex flex-col p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                  <span>{featuredArticle.category}</span>
                  <span className="text-cars-gray">{featuredArticle.readTime}</span>
                </div>
                <h3 className="mt-3 max-w-2xl text-3xl font-apercu-bold leading-tight text-cars-primary">
                  {featuredArticle.title}
                </h3>
                <p className="mt-4 max-w-2xl line-clamp-4 text-sm leading-7 text-cars-gray md:text-base">
                  {featuredArticle.summary}
                </p>

                <div className="mt-6 rounded-[24px] bg-cars-off-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    Why read this
                  </p>
                  <ul className="mt-3 space-y-3 text-sm leading-6 text-cars-primary">
                    {featuredArticle.takeaways.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>

                <span className="mt-auto inline-flex pt-6 text-sm font-semibold text-cars-primary transition-colors group-hover:text-cars-accent">
                  Read more
                </span>
              </div>
            </div>
          </Link>
        </section>

        <section className="mt-8">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                More articles
              </p>
              <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">
                Browse the full guide library
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-cars-gray">
              Open a full article when you want the details, or keep scanning here when you are still narrowing down the next topic.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {articleList.map((article) => (
              <Link
                key={article.slug}
                href={`/tips/${article.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-cars-gray-light/80 bg-white transition-all hover:-translate-y-1 hover:border-cars-accent/25 hover:shadow-[0_18px_42px_rgba(15,45,98,0.12)]"
              >
                <div className="relative h-56 overflow-hidden bg-cars-off-white">
                  <Image
                    src={article.image}
                    alt={article.title}
                    fill
                    sizes="(max-width: 1280px) 50vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    <span>{article.category}</span>
                    <span className="text-cars-gray">{article.readTime}</span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-xl font-apercu-bold leading-7 text-cars-primary">
                    {article.title}
                  </h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-cars-gray">
                    {article.summary}
                  </p>
                  <span className="mt-auto inline-flex pt-5 text-sm font-semibold text-cars-primary transition-colors group-hover:text-cars-accent">
                    Read more
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
