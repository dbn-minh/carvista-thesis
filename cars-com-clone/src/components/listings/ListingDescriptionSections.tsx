"use client";

import type { ReactNode } from "react";

function hasStructuredLine(line: string) {
  const text = line.trim();
  if (!text) return false;

  const separatorIndex = text.indexOf(":");
  return separatorIndex > 0 && separatorIndex < text.length - 1;
}

function getSellerNoteLines(description: string | null | undefined) {
  const source = typeof description === "string" ? description.trim() : "";
  if (!source) return [];

  const blocks = source
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const [firstLine, ...remainingLines] = lines;
    const inlineSellerNote = /^seller note:\s*(.+)$/i.exec(firstLine || "");

    if (inlineSellerNote?.[1]) return [inlineSellerNote[1], ...remainingLines];
    if (/^seller note:\s*$/i.test(firstLine || "")) return remainingLines;
  }

  const firstBlockLines = blocks[0]
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (firstBlockLines?.length && !firstBlockLines.some(hasStructuredLine)) {
    return firstBlockLines;
  }

  return [];
}

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-[16px] border border-cars-primary/10 bg-white px-4 py-4 shadow-[0_10px_22px_rgba(15,45,98,0.10)] ${className}`}
    >
      <h3 className="text-sm font-apercu-bold uppercase tracking-[0.04em] text-cars-accent">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </article>
  );
}

type Props = {
  description: string | null | undefined;
};

export default function ListingDescriptionSections({ description }: Props) {
  const sellerNote = getSellerNoteLines(description);
  const hasSellerNote = sellerNote.length > 0;

  return (
    <section className="mb-8 section-shell p-4 sm:p-5 md:p-6">
      <div>
        <h2 className="text-2xl font-apercu-bold uppercase tracking-[0.02em] text-cars-accent sm:text-3xl">
          Seller description
        </h2>
        <p className="mt-1 text-lg font-semibold text-cars-primary">
          Notes and vehicle condition
        </p>
      </div>

      <div className="mt-5">
        <SectionCard title="Seller note">
          {hasSellerNote ? (
            <div className="space-y-3">
              {sellerNote.map((line) => (
                <p
                  key={line}
                  className="break-words text-sm leading-6 text-cars-primary"
                >
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-cars-gray">
              Seller has not added a description yet.
            </p>
          )}
        </SectionCard>
      </div>
    </section>
  );
}
