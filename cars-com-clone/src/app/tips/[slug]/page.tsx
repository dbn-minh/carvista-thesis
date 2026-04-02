import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
  editorialArticles,
  getEditorialArticleBySlug,
  getRelatedEditorialArticles,
} from "@/lib/editorial-content";

export function generateStaticParams() {
  return editorialArticles.map((article) => ({
    slug: article.slug,
  }));
}

export default async function TipArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getEditorialArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const relatedArticles = getRelatedEditorialArticles(slug, 3);

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden border border-cars-gray-light/70 bg-white">
          <div className="relative h-[320px] overflow-hidden bg-cars-off-white md:h-[420px]">
            <Image
              src={article.image}
              alt={article.title}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,22,52,0.15),rgba(10,22,52,0.72))]" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-8">
              <Link
                href="/tips"
                className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm"
              >
                Back to tips
              </Link>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
                <span>{article.category}</span>
                <span>{article.readTime}</span>
              </div>
              <h1 className="mt-3 max-w-4xl text-4xl font-apercu-bold leading-tight md:text-5xl">
                {article.title}
              </h1>
            </div>
          </div>

          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,0.95fr)_320px] lg:px-8">
            <article className="max-w-3xl">
              <p className="text-lg leading-8 text-cars-gray">{article.summary}</p>

              <div className="mt-8 space-y-8">
                {article.body.map((section) => (
                  <section key={section.heading}>
                    <h2 className="text-2xl font-apercu-bold text-cars-primary">
                      {section.heading}
                    </h2>
                    <p className="mt-3 text-base leading-8 text-cars-gray">{section.text}</p>
                  </section>
                ))}
              </div>
            </article>

            <aside className="space-y-5">
              <div className="rounded-[26px] bg-cars-off-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                  Key tips
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-cars-primary">
                  {article.takeaways.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[26px] border border-cars-primary/10 bg-[linear-gradient(180deg,rgba(233,241,255,0.72),rgba(255,255,255,1))] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                  Next step
                </p>
                <p className="mt-3 text-sm leading-6 text-cars-gray">
                  When you are ready to move from research to action, jump into live listings and compare real cars for sale.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/listings"
                    className="rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
                  >
                    Browse listings
                  </Link>
                  <Link
                    href="/tips"
                    className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary"
                  >
                    More tips
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Related articles
              </p>
              <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">
                Keep reading
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-cars-gray">
              More guides that pair well with this one, whether you are comparing cars, checking value, or narrowing down a shortlist.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {relatedArticles.map((related) => (
              <Link
                key={related.slug}
                href={`/tips/${related.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-cars-gray-light/80 bg-white transition-all hover:-translate-y-1 hover:border-cars-accent/25 hover:shadow-[0_18px_42px_rgba(15,45,98,0.12)]"
              >
                <div className="relative h-52 overflow-hidden bg-cars-off-white">
                  <Image
                    src={related.image}
                    alt={related.title}
                    fill
                    sizes="(max-width: 1280px) 50vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    <span>{related.category}</span>
                    <span className="text-cars-gray">{related.readTime}</span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-xl font-apercu-bold leading-7 text-cars-primary">
                    {related.title}
                  </h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-cars-gray">
                    {related.summary}
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
