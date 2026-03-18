"use client";

import { FormEvent, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import JsonPreview from "@/components/common/JsonPreview";
import { aiApi } from "@/lib/carvista-api";

function parseIds(input: string): number[] {
  return input
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x));
}

export default function AiPage() {
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [result, setResult] = useState<unknown>(null);

  const [compareIds, setCompareIds] = useState("1,2");
  const [compareMarketId, setCompareMarketId] = useState("1");

  const [predictVariantId, setPredictVariantId] = useState("1");
  const [predictMarketId, setPredictMarketId] = useState("1");

  const [profileId, setProfileId] = useState("1");
  const [basePrice, setBasePrice] = useState("700000000");
  const [ownershipYears, setOwnershipYears] = useState("5");

  const [chatMessage, setChatMessage] = useState("So sánh [1,2] giúp tôi");
  const [chatMarketId, setChatMarketId] = useState("1");

  async function handleCompare(e: FormEvent) {
    e.preventDefault();
    try {
      const data = await aiApi.compare({
        variant_ids: parseIds(compareIds),
        market_id: Number(compareMarketId),
        price_type: "avg_market",
      });
      setTone("success");
      setMessage("Compare completed.");
      setResult(data);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Compare failed");
      setResult(null);
    }
  }

  async function handlePredict(e: FormEvent) {
    e.preventDefault();
    try {
      const data = await aiApi.predictPrice({
        variant_id: Number(predictVariantId),
        market_id: Number(predictMarketId),
        price_type: "avg_market",
        horizon_months: 6,
      });
      setTone("success");
      setMessage("Predict completed.");
      setResult(data);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Predict failed");
      setResult(null);
    }
  }

  async function handleTco(e: FormEvent) {
    e.preventDefault();
    try {
      const data = await aiApi.tco({
        profile_id: Number(profileId),
        base_price: Number(basePrice),
        ownership_years: Number(ownershipYears),
      });
      setTone("success");
      setMessage("TCO completed.");
      setResult(data);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "TCO failed");
      setResult(null);
    }
  }

  async function handleChat(e: FormEvent) {
    e.preventDefault();
    try {
      const data = await aiApi.chat({
        message: chatMessage,
        context: { market_id: Number(chatMarketId) },
      });
      setTone("success");
      setMessage("Chat completed.");
      setResult(data);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Chat failed");
      setResult(null);
    }
  }

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <h1 className="mb-4 text-3xl font-bold">AI playground</h1>
        <p className="mb-6 text-sm text-slate-600">
          Dùng page này để test trực tiếp 4 AI endpoints hiện có của backend.
        </p>
        <div className="mb-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <form onSubmit={handleCompare} className="rounded-2xl border p-4">
            <h2 className="mb-3 text-xl font-semibold">Compare variants</h2>
            <input
              className="mb-3 w-full rounded border px-3 py-2"
              value={compareIds}
              onChange={(e) => setCompareIds(e.target.value)}
              placeholder="1,2"
            />
            <input
              className="mb-3 w-full rounded border px-3 py-2"
              value={compareMarketId}
              onChange={(e) => setCompareMarketId(e.target.value)}
              placeholder="market_id"
            />
            <button className="rounded bg-purple-800 px-4 py-2 text-white" type="submit">
              Run compare
            </button>
          </form>

          <form onSubmit={handlePredict} className="rounded-2xl border p-4">
            <h2 className="mb-3 text-xl font-semibold">Predict price</h2>
            <input
              className="mb-3 w-full rounded border px-3 py-2"
              value={predictVariantId}
              onChange={(e) => setPredictVariantId(e.target.value)}
              placeholder="variant_id"
            />
            <input
              className="mb-3 w-full rounded border px-3 py-2"
              value={predictMarketId}
              onChange={(e) => setPredictMarketId(e.target.value)}
              placeholder="market_id"
            />
            <button className="rounded bg-purple-800 px-4 py-2 text-white" type="submit">
              Run predict
            </button>
          </form>

          <form onSubmit={handleTco} className="rounded-2xl border p-4">
            <h2 className="mb-3 text-xl font-semibold">Calculate TCO</h2>
            <input
              className="mb-3 w-full rounded border px-3 py-2"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              placeholder="profile_id"
            />
            <input
              className="mb-3 w-full rounded border px-3 py-2"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="base_price"
            />
            <input
              className="mb-3 w-full rounded border px-3 py-2"
              value={ownershipYears}
              onChange={(e) => setOwnershipYears(e.target.value)}
              placeholder="ownership_years"
            />
            <button className="rounded bg-purple-800 px-4 py-2 text-white" type="submit">
              Run TCO
            </button>
          </form>

          <form onSubmit={handleChat} className="rounded-2xl border p-4">
            <h2 className="mb-3 text-xl font-semibold">Car advisor chat</h2>
            <textarea
              className="mb-3 min-h-[120px] w-full rounded border px-3 py-2"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
            />
            <input
              className="mb-3 w-full rounded border px-3 py-2"
              value={chatMarketId}
              onChange={(e) => setChatMarketId(e.target.value)}
              placeholder="context.market_id"
            />
            <button className="rounded bg-purple-800 px-4 py-2 text-white" type="submit">
              Run chat
            </button>
          </form>
        </div>

        <div className="mt-8">
          <JsonPreview title="AI result" data={result} />
        </div>
      </main>
    </>
  );
}
