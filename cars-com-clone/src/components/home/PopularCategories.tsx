"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildCompareHref } from "@/lib/compare";
import type { Make, Model, VariantListItem } from "@/lib/types";

type CompareSelection = {
  makeId: string;
  modelId: string;
  year: string;
};

const emptySelection: CompareSelection = {
  makeId: "",
  modelId: "",
  year: "",
};

async function fetchCompareReadyVariants() {
  return apiFetch<{ items: VariantListItem[] }>("/catalog/variants?compareReady=true");
}

function buildVehicleLabel(selection: CompareSelection, makes: Make[], models: Model[]) {
  const makeName = makes.find((item) => String(item.make_id) === selection.makeId)?.name;
  const modelName = models.find((item) => String(item.model_id) === selection.modelId)?.name;
  const parts = [selection.year, makeName, modelName].filter(Boolean);
  return parts.join(" ");
}

function CompareColumn({
  title,
  selection,
  makes,
  models,
  years,
  loadingModels,
  onChange,
}: {
  title: string;
  selection: CompareSelection;
  makes: Make[];
  models: Model[];
  years: string[];
  loadingModels: boolean;
  onChange: (next: CompareSelection) => void;
}) {
  return (
    <div className="rounded-[28px] border border-cars-gray-light/80 bg-white p-5 shadow-[0_16px_38px_rgba(15,45,98,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">{title}</p>
      <div className="mt-4 grid gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-cars-primary">Make</label>
          <Select
            value={selection.makeId}
            onValueChange={(value) => onChange({ makeId: value, modelId: "", year: "" })}
          >
            <SelectTrigger className="h-11 rounded-2xl border-cars-gray-light bg-white text-cars-primary">
              <SelectValue placeholder="Choose a make" />
            </SelectTrigger>
            <SelectContent>
              {makes.map((make) => (
                <SelectItem key={make.make_id} value={String(make.make_id)}>
                  {make.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-cars-primary">Model</label>
          <Select
            value={selection.modelId}
            onValueChange={(value) => onChange({ ...selection, modelId: value, year: "" })}
            disabled={!selection.makeId || loadingModels || models.length === 0}
          >
            <SelectTrigger className="h-11 rounded-2xl border-cars-gray-light bg-white text-cars-primary">
              <SelectValue
                placeholder={
                  !selection.makeId
                    ? "Choose a make first"
                    : loadingModels
                      ? "Loading models"
                      : "Choose a model"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.model_id} value={String(model.model_id)}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-cars-primary">Year</label>
          <Select
            value={selection.year}
            onValueChange={(value) => onChange({ ...selection, year: value })}
            disabled={!selection.modelId || years.length === 0}
          >
            <SelectTrigger className="h-11 rounded-2xl border-cars-gray-light bg-white text-cars-primary">
              <SelectValue
                placeholder={!selection.modelId ? "Choose a model first" : years.length === 0 ? "No years available" : "Select a year"}
              />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export default function PopularCategories() {
  const router = useRouter();
  const [makes, setMakes] = useState<Make[]>([]);
  const [compareVariants, setCompareVariants] = useState<VariantListItem[]>([]);
  const [left, setLeft] = useState<CompareSelection>(emptySelection);
  const [right, setRight] = useState<CompareSelection>(emptySelection);
  const [loadingMakes, setLoadingMakes] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMakes() {
      setLoadingMakes(true);
      setErrorMessage("");

      try {
        const response = await fetchCompareReadyVariants();
        if (cancelled) return;
        setCompareVariants(response.items);
        const uniqueMakes = Array.from(
          new Map(
            response.items.map((item) => [
              item.make_id,
              { make_id: item.make_id, name: item.make_name },
            ])
          ).values()
        ).sort((a, b) => a.name.localeCompare(b.name));
        setMakes(uniqueMakes);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load compare-ready vehicles right now."
        );
      } finally {
        if (!cancelled) {
          setLoadingMakes(false);
        }
      }
    }

    void loadMakes();

    return () => {
      cancelled = true;
    };
  }, []);

  const leftModels = useMemo(() => {
    if (!left.makeId) return [];
    return Array.from(
      new Map(
        compareVariants
          .filter((item) => String(item.make_id) === left.makeId)
          .map((item) => [
            item.model_id,
            {
              model_id: item.model_id,
              make_id: item.make_id,
              name: item.model_name,
            },
          ])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [compareVariants, left.makeId]);

  const rightModels = useMemo(() => {
    if (!right.makeId) return [];
    return Array.from(
      new Map(
        compareVariants
          .filter((item) => String(item.make_id) === right.makeId)
          .map((item) => [
            item.model_id,
            {
              model_id: item.model_id,
              make_id: item.make_id,
              name: item.model_name,
            },
          ])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [compareVariants, right.makeId]);

  const leftYears = useMemo(() => {
    if (!left.makeId || !left.modelId) return [];
    return Array.from(
      new Set(
        compareVariants
          .filter(
            (item) =>
              String(item.make_id) === left.makeId &&
              String(item.model_id) === left.modelId
          )
          .map((item) => String(item.model_year))
      )
    ).sort((a, b) => Number(b) - Number(a));
  }, [compareVariants, left.makeId, left.modelId]);

  const rightYears = useMemo(() => {
    if (!right.makeId || !right.modelId) return [];
    return Array.from(
      new Set(
        compareVariants
          .filter(
            (item) =>
              String(item.make_id) === right.makeId &&
              String(item.model_id) === right.modelId
          )
          .map((item) => String(item.model_year))
      )
    ).sort((a, b) => Number(b) - Number(a));
  }, [compareVariants, right.makeId, right.modelId]);

  const compareSummary = useMemo(() => {
    const leftLabel = buildVehicleLabel(left, makes, leftModels);
    const rightLabel = buildVehicleLabel(right, makes, rightModels);

    if (!leftLabel || !rightLabel) {
      return "Choose two supported cars from the current compare catalog.";
    }

    return `Ready to compare ${leftLabel} and ${rightLabel}.`;
  }, [left, right, makes, leftModels, rightModels]);

  function handleCompare() {
    if (!left.makeId || !left.modelId || !right.makeId || !right.modelId) {
      setErrorMessage("Choose two cars before starting the comparison.");
      return;
    }

    const leftLabel = buildVehicleLabel(left, makes, leftModels);
    const rightLabel = buildVehicleLabel(right, makes, rightModels);

    if (!leftLabel || !rightLabel) {
      setErrorMessage("Choose two complete car profiles before comparing.");
      return;
    }

    if (leftLabel === rightLabel) {
      setErrorMessage("Pick two different cars so the comparison stays useful.");
      return;
    }

    setErrorMessage("");
    router.push(
      buildCompareHref({
        leftQuery: leftLabel,
        rightQuery: rightLabel,
        marketId: 1,
      })
    );
  }

  return (
    <section className="py-10">
      <div className="container-cars">
        <div className="section-shell overflow-hidden border border-cars-primary/10 bg-[linear-gradient(180deg,rgba(233,241,255,0.72),rgba(255,255,255,1))] p-6 md:p-8">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Compare
              </p>
              <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">
                Compare two cars
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Start with two shortlists and let CarVista highlight the trade-offs that matter most.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/listings"
                className="inline-flex rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
              >
                Browse listings
              </Link>
              <Link
                href="/tips"
                className="inline-flex rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
              >
                Read buying tips
              </Link>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <CompareColumn
              title="Car one"
              selection={left}
              makes={makes}
              models={leftModels}
              years={leftYears}
              loadingModels={loadingMakes}
              onChange={setLeft}
            />

            <div className="flex items-center justify-center">
              <div className="rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cars-primary/15">
                vs
              </div>
            </div>

            <CompareColumn
              title="Car two"
              selection={right}
              makes={makes}
              models={rightModels}
              years={rightYears}
              loadingModels={loadingMakes}
              onChange={setRight}
            />
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-[26px] border border-cars-primary/10 bg-white px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-cars-primary">
                {loadingMakes ? "Loading compare options..." : compareSummary}
              </p>
              <p className="mt-1 text-sm text-cars-gray">
                Only compare-ready vehicles already in the CarVista catalog appear here.
              </p>
              {errorMessage ? <p className="mt-2 text-sm font-medium text-red-600">{errorMessage}</p> : null}
            </div>

            <Button
              type="button"
              onClick={handleCompare}
              disabled={loadingMakes}
              className="h-11 rounded-full bg-cars-primary px-6 text-sm font-semibold text-white hover:bg-cars-primary-light"
            >
              Compare now
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
