"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { catalogApi } from "@/lib/carvista-api";
import { buildCompareHref } from "@/lib/compare";
import type { Make, Model } from "@/lib/types";

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

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 8 }, (_, index) => String(currentYear - index));

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
  loadingModels,
  onChange,
}: {
  title: string;
  selection: CompareSelection;
  makes: Make[];
  models: Model[];
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
            onValueChange={(value) => onChange({ makeId: value, modelId: "", year: selection.year })}
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
            onValueChange={(value) => onChange({ ...selection, modelId: value })}
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
          <Select value={selection.year} onValueChange={(value) => onChange({ ...selection, year: value })}>
            <SelectTrigger className="h-11 rounded-2xl border-cars-gray-light bg-white text-cars-primary">
              <SelectValue placeholder="Select a year" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
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
  const [leftModels, setLeftModels] = useState<Model[]>([]);
  const [rightModels, setRightModels] = useState<Model[]>([]);
  const [left, setLeft] = useState<CompareSelection>(emptySelection);
  const [right, setRight] = useState<CompareSelection>(emptySelection);
  const [loadingMakes, setLoadingMakes] = useState(true);
  const [loadingLeftModels, setLoadingLeftModels] = useState(false);
  const [loadingRightModels, setLoadingRightModels] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMakes() {
      setLoadingMakes(true);
      setErrorMessage("");

      try {
        const response = await catalogApi.makes();
        if (cancelled) return;
        const sorted = [...response.items].sort((a, b) => a.name.localeCompare(b.name));
        setMakes(sorted);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load makes right now."
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

  useEffect(() => {
    let cancelled = false;

    if (!left.makeId) {
      setLeftModels([]);
      return;
    }

    async function loadModels() {
      setLoadingLeftModels(true);
      setErrorMessage("");
      try {
        const response = await catalogApi.models(Number(left.makeId));
        if (cancelled) return;
        const sorted = [...response.items].sort((a, b) => a.name.localeCompare(b.name));
        setLeftModels(sorted);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load models right now."
        );
      } finally {
        if (!cancelled) {
          setLoadingLeftModels(false);
        }
      }
    }

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, [left.makeId]);

  useEffect(() => {
    let cancelled = false;

    if (!right.makeId) {
      setRightModels([]);
      return;
    }

    async function loadModels() {
      setLoadingRightModels(true);
      setErrorMessage("");
      try {
        const response = await catalogApi.models(Number(right.makeId));
        if (cancelled) return;
        const sorted = [...response.items].sort((a, b) => a.name.localeCompare(b.name));
        setRightModels(sorted);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load models right now."
        );
      } finally {
        if (!cancelled) {
          setLoadingRightModels(false);
        }
      }
    }

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, [right.makeId]);

  const compareSummary = useMemo(() => {
    const leftLabel = buildVehicleLabel(left, makes, leftModels);
    const rightLabel = buildVehicleLabel(right, makes, rightModels);

    if (!leftLabel || !rightLabel) {
      return "Choose two cars and CarVista will line up the key trade-offs for you.";
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
              loadingModels={loadingLeftModels}
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
              loadingModels={loadingRightModels}
              onChange={setRight}
            />
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-[26px] border border-cars-primary/10 bg-white px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-cars-primary">
                {loadingMakes ? "Loading compare options..." : compareSummary}
              </p>
              <p className="mt-1 text-sm text-cars-gray">
                You can compare daily drivers, family SUVs, hybrids, and more from one place.
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
