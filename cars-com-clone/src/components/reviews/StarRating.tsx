"use client";

import { Star } from "lucide-react";

type Props = {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  label?: string;
};

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;

export default function StarRating({
  value,
  onChange,
  size = "md",
  label,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-1"
        role={onChange ? "radiogroup" : undefined}
        aria-label={label || "Rating"}
      >
        {Array.from({ length: 5 }).map((_, index) => {
          const starValue = index + 1;
          const active = starValue <= value;
          const className = sizeClasses[size];

          if (!onChange) {
            return (
              <Star
                key={starValue}
                className={`${className} ${active ? "fill-amber-400 text-amber-400" : "text-cars-gray-light"}`}
              />
            );
          }

          return (
            <button
              key={starValue}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${starValue} star${starValue === 1 ? "" : "s"}`}
              onClick={() => onChange(starValue)}
              className="rounded-full p-1 transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cars-accent/25"
            >
              <Star
                className={`${className} ${active ? "fill-amber-400 text-amber-400" : "text-cars-gray-light hover:text-amber-300"}`}
              />
            </button>
          );
        })}
      </div>
      <span className="text-sm font-medium text-cars-gray">{value}/5</span>
    </div>
  );
}
