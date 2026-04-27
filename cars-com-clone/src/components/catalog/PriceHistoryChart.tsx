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

const PRICE_HISTORY_TIMEFRAME_MONTHS = 12;

function getMonthKey(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;

  const date = new Date(parsed);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

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

  const visiblePoints = useMemo<PriceHistoryPoint[]>(() => {
    if (points.length <= 1) return points;

    const monthlySnapshots = new Map<string, PriceHistoryPoint>();

    for (const point of points) {
      const monthKey = getMonthKey(point.capturedAt);
      const existingPoint = monthlySnapshots.get(monthKey);

      if (!existingPoint || Date.parse(point.capturedAt) >= Date.parse(existingPoint.capturedAt)) {
        monthlySnapshots.set(monthKey, {
          ...point,
          capturedLabel: formatDateLabel(point.capturedAt),
        });
      }
    }

    const monthlyPoints = Array.from(monthlySnapshots.values()).sort(
      (left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt)
    );

    if (monthlyPoints.length <= PRICE_HISTORY_TIMEFRAME_MONTHS) return monthlyPoints;
    return monthlyPoints.slice(-PRICE_HISTORY_TIMEFRAME_MONTHS);
  }, [points]);

  const latestPoint = points[points.length - 1] ?? null;
  const trend = useMemo(() => buildTrend(visiblePoints), [visiblePoints]);

  const chart = useMemo(() => {
    if (visiblePoints.length === 0) return null;

    const width = 480;
    const height = 260;
    const padding = { top: 18, right: 16, bottom: 38, left: 74 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const min = Math.min(...visiblePoints.map((point) => point.price));
    const max = Math.max(...visiblePoints.map((point) => point.price));
    const spread = max - min;
    const paddingValue = spread > 0 ? spread * 0.14 : Math.max(max * 0.08, 1);
    const domainMin = Math.max(0, min - paddingValue);
    const domainMax = max + paddingValue;
    const domainSpread = Math.max(domainMax - domainMin, 1);

    const xForIndex = (index: number) =>
      padding.left +
      (visiblePoints.length === 1
        ? plotWidth / 2
        : (plotWidth / (visiblePoints.length - 1)) * index);
    const yForPrice = (price: number) =>
      padding.top + plotHeight - ((price - domainMin) / domainSpread) * plotHeight;

    const linePoints = visiblePoints
      .map((point, index) => `${xForIndex(index)},${yForPrice(point.price)}`)
      .join(" ");

    const areaPoints = [
      `${xForIndex(0)},${padding.top + plotHeight}`,
      ...visiblePoints.map((point, index) => `${xForIndex(index)},${yForPrice(point.price)}`),
      `${xForIndex(visiblePoints.length - 1)},${padding.top + plotHeight}`,
    ].join(" ");

    const yTicks = Array.from({ length: 4 }, (_, index) => {
      const ratio = index / 3;
      const value = domainMax - domainSpread * ratio;
      return {
        y: padding.top + plotHeight * ratio,
        label: toCurrency(Math.round(value)),
      };
    });

    const xTickIndexes = Array.from(
      new Set(
        visiblePoints.length <= 4
          ? visiblePoints.map((_, index) => index)
          : [
              0,
              Math.floor((visiblePoints.length - 1) / 3),
              Math.floor(((visiblePoints.length - 1) * 2) / 3),
              visiblePoints.length - 1,
            ]
      )
    );
    const xTicks = xTickIndexes.map((index) => ({
      x: xForIndex(index),
      label: visiblePoints[index]?.capturedLabel ?? "",
    }));

    return {
      width,
      height,
      padding,
      plotBottom: padding.top + plotHeight,
      linePoints,
      areaPoints,
      markers: visiblePoints.map((point, index) => ({
        x: xForIndex(index),
        y: yForPrice(point.price),
        label: `${point.capturedLabel}: ${toCurrency(point.price)}`,
      })),
      yTicks,
      xTicks,
    };
  }, [visiblePoints]);

  if (points.length === 0 || !chart) {
    return (
      <div className="mt-5 rounded-[24px] border border-dashed border-cars-primary/12 bg-white px-5 py-10 text-center text-sm text-cars-gray dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        No price history is available for this vehicle yet.
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-[22px] border border-cars-primary/10 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,45,98,0.05)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8fb4ff]">
            Latest market price
          </p>
          <p className="mt-2 text-lg font-apercu-bold text-cars-primary dark:text-slate-50">
            {latestPoint ? toCurrency(latestPoint.price) : "-"}
          </p>
          <p className="mt-2 text-sm text-cars-gray dark:text-slate-300">
            {latestPoint ? `Captured ${latestPoint.capturedLabel}` : "No recent capture"}
          </p>
        </article>

        <article className="rounded-[22px] border border-cars-primary/10 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,45,98,0.05)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8fb4ff]">
            Trend
          </p>
          <p className="mt-2 text-lg font-apercu-bold text-cars-primary dark:text-slate-50">{trend.label}</p>
          <p className="mt-2 text-sm text-cars-gray dark:text-slate-300">{trend.detail}</p>
        </article>

        <article className="rounded-[22px] border border-cars-primary/10 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,45,98,0.05)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8fb4ff]">
            Data points
          </p>
          <p className="mt-2 text-lg font-apercu-bold text-cars-primary dark:text-slate-50">{points.length}</p>
          <p className="mt-2 text-sm text-cars-gray dark:text-slate-300">
            Condensed into one monthly snapshot across the latest year.
          </p>
        </article>
      </div>

      <div className="overflow-hidden rounded-[26px] border border-cars-primary/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,245,252,0.98))] p-4 shadow-[0_16px_36px_rgba(15,45,98,0.08)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(18,24,35,0.98),rgba(11,15,22,0.98))] dark:shadow-none md:p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cars-primary dark:text-slate-50">Market price trend</p>
            <p className="text-xs text-cars-gray dark:text-slate-400">
              Showing the latest 12 months with one price point per month.
            </p>
          </div>
        </div>

        <div className="pb-1">
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="h-[220px] w-full sm:h-[260px]"
            role="img"
            aria-label="Vehicle price history chart"
          >
            <defs>
              <linearGradient id="price-history-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" style={{ stopColor: "rgb(var(--cars-primary-light) / 0.34)" }} />
                <stop offset="100%" style={{ stopColor: "rgb(var(--cars-primary-light) / 0.06)" }} />
              </linearGradient>
            </defs>

            {chart.yTicks.map((tick) => (
              <g key={tick.y}>
                <line
                  x1={chart.padding.left}
                  y1={tick.y}
                  x2={chart.width - chart.padding.right}
                  y2={tick.y}
                  style={{ stroke: "hsl(var(--border) / 0.78)" }}
                  strokeDasharray="4 6"
                />
                <text
                  x={chart.padding.left - 12}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="12"
                  style={{ fill: "rgb(var(--theme-muted-rgb) / 0.92)" }}
                >
                  {tick.label}
                </text>
              </g>
            ))}

            <polygon points={chart.areaPoints} fill="url(#price-history-fill)" />
            <polyline
              points={chart.linePoints}
              fill="none"
              style={{ stroke: "rgb(var(--cars-primary-light) / 0.98)" }}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {chart.markers.map((marker) => (
              <g key={marker.label}>
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r="6"
                  style={{
                    fill: "hsl(var(--surface))",
                    stroke: "rgb(var(--cars-accent) / 0.92)",
                  }}
                  strokeWidth="3"
                >
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
                style={{ fill: "rgb(var(--theme-muted-rgb) / 0.92)" }}
              >
                {tick.label}
              </text>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
