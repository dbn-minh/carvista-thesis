"use client";

import { useMemo } from "react";
import { toCurrency } from "@/lib/api-client";

type PriceHistoryRow = Record<string, unknown>;

type PriceHistoryPoint = {
  capturedAt: string;
  capturedLabel: string;
  price: number;
  source: string;
};

function formatDateLabel(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "2-digit",
  }).format(new Date(parsed));
}

function buildTrend(points: PriceHistoryPoint[]) {
  if (points.length < 2) {
    return {
      label: "Limited data",
      detail: "Need at least two points to show a trend.",
    };
  }

  const first = points[0]?.price ?? 0;
  const last = points[points.length - 1]?.price ?? 0;
  if (!first || !last) {
    return {
      label: "Limited data",
      detail: "Recent price points are not strong enough to show a trend.",
    };
  }

  const changeRatio = (last - first) / first;
  const changePercent = `${changeRatio >= 0 ? "+" : ""}${(changeRatio * 100).toFixed(1)}%`;

  if (Math.abs(changeRatio) < 0.03) {
    return {
      label: "Stable pricing",
      detail: `${changePercent} across the visible history.`,
    };
  }

  return {
    label: changeRatio > 0 ? "Uptrend" : "Downtrend",
    detail: `${changePercent} across the visible history.`,
  };
}

export default function PriceHistoryChart({ rows }: { rows: PriceHistoryRow[] }) {
  const points = useMemo<PriceHistoryPoint[]>(() => {
    return rows
      .map((row) => {
        const numericPrice = Number(row.price);
        const capturedAt = String(row.captured_at ?? row.date ?? "");

        if (!Number.isFinite(numericPrice) || !capturedAt) return null;

        return {
          capturedAt,
          capturedLabel: formatDateLabel(capturedAt),
          price: numericPrice,
          source: String(row.source ?? "Market snapshot"),
        };
      })
      .filter((row): row is PriceHistoryPoint => Boolean(row))
      .sort((left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt));
  }, [rows]);

  const latestPoint = points[points.length - 1] ?? null;
  const trend = useMemo(() => buildTrend(points), [points]);

  const chart = useMemo(() => {
    if (points.length === 0) return null;

    const width = 720;
    const height = 260;
    const padding = { top: 18, right: 20, bottom: 36, left: 88 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const min = Math.min(...points.map((point) => point.price));
    const max = Math.max(...points.map((point) => point.price));
    const spread = max - min;
    const paddingValue = spread > 0 ? spread * 0.14 : Math.max(max * 0.08, 1);
    const domainMin = Math.max(0, min - paddingValue);
    const domainMax = max + paddingValue;
    const domainSpread = Math.max(domainMax - domainMin, 1);

    const xForIndex = (index: number) =>
      padding.left + (points.length === 1 ? plotWidth / 2 : (plotWidth / (points.length - 1)) * index);
    const yForPrice = (price: number) =>
      padding.top + plotHeight - ((price - domainMin) / domainSpread) * plotHeight;

    const linePoints = points
      .map((point, index) => `${xForIndex(index)},${yForPrice(point.price)}`)
      .join(" ");

    const areaPoints = [
      `${xForIndex(0)},${padding.top + plotHeight}`,
      ...points.map((point, index) => `${xForIndex(index)},${yForPrice(point.price)}`),
      `${xForIndex(points.length - 1)},${padding.top + plotHeight}`,
    ].join(" ");

    const yTicks = Array.from({ length: 4 }, (_, index) => {
      const ratio = index / 3;
      const value = domainMax - domainSpread * ratio;
      return {
        y: padding.top + plotHeight * ratio,
        label: toCurrency(Math.round(value)),
      };
    });

    const xTickIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]));
    const xTicks = xTickIndexes.map((index) => ({
      x: xForIndex(index),
      label: points[index]?.capturedLabel ?? "",
    }));

    return {
      width,
      height,
      padding,
      plotHeight,
      plotBottom: padding.top + plotHeight,
      linePoints,
      areaPoints,
      markers: points.map((point, index) => ({
        x: xForIndex(index),
        y: yForPrice(point.price),
        label: `${point.capturedLabel}: ${toCurrency(point.price)}`,
      })),
      yTicks,
      xTicks,
    };
  }, [points]);

  if (points.length === 0 || !chart) {
    return (
      <div className="mt-5 rounded-[24px] border border-dashed border-cars-primary/15 bg-cars-off-white px-5 py-10 text-center text-sm text-cars-gray">
        No price history is available for this vehicle yet.
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-[22px] border border-cars-gray-light/70 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
            Latest market price
          </p>
          <p className="mt-2 text-lg font-apercu-bold text-cars-primary">
            {latestPoint ? toCurrency(latestPoint.price) : "-"}
          </p>
          <p className="mt-2 text-sm text-cars-gray">
            {latestPoint ? `Captured ${latestPoint.capturedLabel}` : "No recent capture"}
          </p>
        </article>

        <article className="rounded-[22px] border border-cars-gray-light/70 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
            Trend
          </p>
          <p className="mt-2 text-lg font-apercu-bold text-cars-primary">{trend.label}</p>
          <p className="mt-2 text-sm text-cars-gray">{trend.detail}</p>
        </article>

        <article className="rounded-[22px] border border-cars-gray-light/70 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
            Data points
          </p>
          <p className="mt-2 text-lg font-apercu-bold text-cars-primary">{points.length}</p>
          <p className="mt-2 text-sm text-cars-gray">
            Based on recorded market snapshots for this vehicle.
          </p>
        </article>
      </div>

      <div className="overflow-hidden rounded-[26px] border border-cars-primary/10 bg-[linear-gradient(180deg,rgba(233,241,255,0.55),rgba(255,255,255,1))] p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-cars-primary">Market price trend</p>
            <p className="text-xs text-cars-gray">Time on the x-axis, price on the y-axis.</p>
          </div>
          {latestPoint ? (
            <p className="text-xs font-medium text-cars-gray">Latest source: {latestPoint.source}</p>
          ) : null}
        </div>

        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-[280px] w-full"
          role="img"
          aria-label="Vehicle price history chart"
        >
          <defs>
            <linearGradient id="price-history-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(46,106,255,0.24)" />
              <stop offset="100%" stopColor="rgba(46,106,255,0.03)" />
            </linearGradient>
          </defs>

          {chart.yTicks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={chart.padding.left}
                y1={tick.y}
                x2={chart.width - chart.padding.right}
                y2={tick.y}
                stroke="rgba(15,45,98,0.08)"
                strokeDasharray="4 6"
              />
              <text
                x={chart.padding.left - 12}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="12"
                fill="rgba(89,103,128,1)"
              >
                {tick.label}
              </text>
            </g>
          ))}

          <polygon points={chart.areaPoints} fill="url(#price-history-fill)" />
          <polyline
            points={chart.linePoints}
            fill="none"
            stroke="rgba(27,58,123,1)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {chart.markers.map((marker) => (
            <g key={marker.label}>
              <circle cx={marker.x} cy={marker.y} r="6" fill="white" stroke="rgba(46,106,255,1)" strokeWidth="3">
                <title>{marker.label}</title>
              </circle>
            </g>
          ))}

          {chart.xTicks.map((tick) => (
            <text
              key={tick.x}
              x={tick.x}
              y={chart.plotBottom + 24}
              textAnchor="middle"
              fontSize="12"
              fill="rgba(89,103,128,1)"
            >
              {tick.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
