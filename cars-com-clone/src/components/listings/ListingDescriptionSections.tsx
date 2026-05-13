"use client";

import type { ReactNode } from "react";

type ListingDescriptionSection = {
  title: string | null;
  lines: string[];
};

type DescriptionDetail = {
  label: string;
  value: string;
};

type DescriptionGroup = {
  title: string;
  lines: string[];
};

type ParsedDescription = {
  sellerNote: string[];
  keyDetails: DescriptionDetail[];
  additionalDetails: DescriptionDetail[];
  vehicleHistory: DescriptionGroup[];
  ownershipDetails: DescriptionGroup[];
};

const KEY_DETAIL_LABELS = new Set(["condition", "owners", "price", "contact preference"]);
const ADDITIONAL_DETAIL_LABELS = new Set([
  "exterior color",
  "interior color",
  "vin",
  "license plate",
  "catalog vehicle",
  "custom vehicle entry",
]);

function parseDescriptionLine(line: string): DescriptionDetail | null {
  const text = line.trim();
  if (!text) return null;

  const separatorIndex = text.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex >= text.length - 1) {
    return null;
  }

  return {
    label: text.slice(0, separatorIndex).trim(),
    value: text.slice(separatorIndex + 1).trim(),
  };
}

function parseListingDescription(
  description: string | null | undefined
): ListingDescriptionSection[] {
  const source = typeof description === "string" ? description.trim() : "";
  if (!source) return [];

  return source
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length === 0) return null;

      const [firstLine, ...remainingLines] = lines;
      if (/^[^:]+:\s*$/.test(firstLine) && remainingLines.length > 0) {
        return {
          title: firstLine.slice(0, -1).trim(),
          lines: remainingLines,
        };
      }

      const hasStructuredLines = lines.some((line) => Boolean(parseDescriptionLine(line)));
      if (!hasStructuredLines && index === 0) {
        return {
          title: "Seller note",
          lines,
        };
      }

      return {
        title: null,
        lines,
      };
    })
    .filter((section): section is ListingDescriptionSection => Boolean(section));
}

function buildParsedDescription(description: string | null | undefined): ParsedDescription {
  const parsed: ParsedDescription = {
    sellerNote: [],
    keyDetails: [],
    additionalDetails: [],
    vehicleHistory: [],
    ownershipDetails: [],
  };

  for (const section of parseListingDescription(description)) {
    const title = section.title?.trim() || "";
    const normalizedTitle = title.toLowerCase();

    if (normalizedTitle === "seller note") {
      parsed.sellerNote.push(...section.lines);
      continue;
    }

    if (
      normalizedTitle === "maintenance history" ||
      normalizedTitle === "accident history"
    ) {
      parsed.vehicleHistory.push({
        title,
        lines: section.lines,
      });
      continue;
    }

    if (
      normalizedTitle === "upgrades and accessories" ||
      normalizedTitle === "reason for selling"
    ) {
      parsed.ownershipDetails.push({
        title,
        lines: section.lines,
      });
      continue;
    }

    for (const line of section.lines) {
      const detail = parseDescriptionLine(line);
      const normalizedLabel = detail?.label.toLowerCase() || "";

      if (detail && KEY_DETAIL_LABELS.has(normalizedLabel)) {
        parsed.keyDetails.push(detail);
      } else if (detail && ADDITIONAL_DETAIL_LABELS.has(normalizedLabel)) {
        parsed.additionalDetails.push(detail);
      } else if (detail) {
        parsed.additionalDetails.push(detail);
      } else if (!parsed.sellerNote.length) {
        parsed.sellerNote.push(line);
      } else {
        parsed.additionalDetails.push({ label: title || "Detail", value: line });
      }
    }
  }

  return parsed;
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

function DetailRows({ items }: { items: DescriptionDetail[] }) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-cars-gray">Not provided.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className="grid gap-1 border-b border-cars-primary/10 pb-2 last:border-b-0 last:pb-0 sm:grid-cols-[112px_minmax(0,1fr)]"
        >
          <p className="text-xs font-apercu-bold uppercase leading-5 tracking-[0.02em] text-cars-primary">
            {item.label}
          </p>
          <p className="break-words text-sm leading-6 text-cars-primary">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function HistoryGroups({ groups }: { groups: DescriptionGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-sm leading-6 text-cars-gray">Not provided.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="text-xs font-apercu-bold uppercase leading-5 tracking-[0.02em] text-cars-primary">
            {group.title}
          </p>
          <div className="mt-1 space-y-1">
            {group.lines.map((line, index) => (
              <p
                key={`${group.title}-${index}`}
                className="break-words text-sm leading-6 text-cars-primary"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SplitGroups({ groups }: { groups: DescriptionGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-sm leading-6 text-cars-gray">Not provided.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((group, index) => (
        <div
          key={group.title}
          className={index > 0 ? "border-cars-primary/10 md:border-l md:pl-4" : ""}
        >
          <p className="text-xs font-apercu-bold uppercase leading-5 tracking-[0.02em] text-cars-primary">
            {group.title}
          </p>
          <div className="mt-1 space-y-1">
            {group.lines.map((line, lineIndex) => (
              <p
                key={`${group.title}-${lineIndex}`}
                className="break-words text-sm leading-6 text-cars-primary"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type Props = {
  description: string | null | undefined;
};

export default function ListingDescriptionSections({ description }: Props) {
  const parsed = buildParsedDescription(description);
  const hasSellerNote = parsed.sellerNote.length > 0;

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

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.25fr_0.68fr_0.7fr]">
        <SectionCard title="Seller note" className="min-h-[210px]">
          {hasSellerNote ? (
            <div className="space-y-3">
              {parsed.sellerNote.map((line, index) => (
                <p
                  key={`seller-note-${index}`}
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

        <SectionCard title="Key details" className="min-h-[210px]">
          <DetailRows items={parsed.keyDetails} />
        </SectionCard>

        <SectionCard title="Vehicle history" className="min-h-[210px]">
          <HistoryGroups groups={parsed.vehicleHistory} />
        </SectionCard>

        <SectionCard title="Additional details" className="min-h-[130px]">
          <DetailRows items={parsed.additionalDetails} />
        </SectionCard>

        <SectionCard title="Additional details" className="min-h-[130px] xl:col-span-2">
          <SplitGroups groups={parsed.ownershipDetails} />
        </SectionCard>
      </div>
    </section>
  );
}
