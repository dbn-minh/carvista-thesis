"use client";

import { FormEvent, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import { aiApi } from "@/lib/carvista-api";
import { useRequireLogin } from "@/lib/auth-guard";

function parseIds(input: string): number[] {
  return input
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x));
}

export default function AiPage() {
  const ready = useRequireLogin("/ai");
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

  const [chatMessage, setChatMessage] = useState("Compare [1,2] for me");
  const [chatMarketId, setChatMarketId] = useState("1");

  if (!ready) return null;

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
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(15,45,98,0.96),rgba(27,76,160,0.92),rgba(95,150,255,0.72))] p-6 text-white md:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">
                AI decision support
              </p>
              <h1 className="mt-2 text-4xl font-apercu-bold">CarVista AI tools</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
                Run the four authenticated AI skills already available in the backend: smart
                compare, price prediction, total cost of ownership, and car advisor chat.
              </p>
            </div>

            <div className="rounded-[28px] bg-white/12 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                Available skills
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-white/90">
                <li>Compare variants using structured pros and cons.</li>
                <li>Predict future price movement for a selected variant.</li>
                <li>Estimate ownership cost using TCO profiles.</li>
                <li>Ask the advisor for a chat-style recommendation.</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-6 xl:grid-cols-2">
            <form onSubmit={handleCompare} className="section-shell p-6">
              <h2 className="text-2xl font-apercu-bold text-cars-primary">Compare variants</h2>
              <p className="mt-3 text-sm leading-6 text-cars-gray">
                Send a list of variant IDs and a market ID to get a structured comparison.
              </p>
              <input
                className="mt-5 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={compareIds}
                onChange={(e) => setCompareIds(e.target.value)}
                placeholder="1,2"
              />
              <input
                className="mt-3 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={compareMarketId}
                onChange={(e) => setCompareMarketId(e.target.value)}
                placeholder="market_id"
              />
              <button
                className="mt-5 rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white"
                type="submit"
              >
                Run compare
              </button>
            </form>

            <form onSubmit={handlePredict} className="section-shell p-6">
              <h2 className="text-2xl font-apercu-bold text-cars-primary">Predict price</h2>
              <p className="mt-3 text-sm leading-6 text-cars-gray">
                Estimate short-term price movement for a chosen variant and market.
              </p>
              <input
                className="mt-5 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={predictVariantId}
                onChange={(e) => setPredictVariantId(e.target.value)}
                placeholder="variant_id"
              />
              <input
                className="mt-3 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={predictMarketId}
                onChange={(e) => setPredictMarketId(e.target.value)}
                placeholder="market_id"
              />
              <button
                className="mt-5 rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white"
                type="submit"
              >
                Run predict
              </button>
            </form>

            <form onSubmit={handleTco} className="section-shell p-6">
              <h2 className="text-2xl font-apercu-bold text-cars-primary">Calculate TCO</h2>
              <p className="mt-3 text-sm leading-6 text-cars-gray">
                Estimate ownership cost using a saved profile, base price, and ownership horizon.
              </p>
              <input
                className="mt-5 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                placeholder="profile_id"
              />
              <input
                className="mt-3 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="base_price"
              />
              <input
                className="mt-3 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={ownershipYears}
                onChange={(e) => setOwnershipYears(e.target.value)}
                placeholder="ownership_years"
              />
              <button
                className="mt-5 rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white"
                type="submit"
              >
                Run TCO
              </button>
            </form>

            <form onSubmit={handleChat} className="section-shell p-6">
              <h2 className="text-2xl font-apercu-bold text-cars-primary">Car advisor chat</h2>
              <p className="mt-3 text-sm leading-6 text-cars-gray">
                Ask a natural-language question and let the advisor use current car skills.
              </p>
              <textarea
                className="mt-5 min-h-[140px] w-full rounded-[24px] border border-cars-gray-light px-4 py-3 text-sm"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
              />
              <input
                className="mt-3 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={chatMarketId}
                onChange={(e) => setChatMarketId(e.target.value)}
                placeholder="context.market_id"
              />
              <button
                className="mt-5 rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white"
                type="submit"
              >
                Run chat
              </button>
            </form>
          </div>

          <aside className="section-shell p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Latest AI result</h2>
            <p className="mt-3 text-sm leading-6 text-cars-gray">
              The most recent response from any AI tool will appear here so you can test the end
              to end backend flow without leaving the page.
            </p>
            <pre className="mt-5 overflow-auto rounded-[24px] bg-cars-off-white p-4 text-xs leading-6 text-cars-primary">
              {result ? JSON.stringify(result, null, 2) : "Run a tool to see the response payload."}
            </pre>
          </aside>
        </div>
      </main>
    </>
  );
}
