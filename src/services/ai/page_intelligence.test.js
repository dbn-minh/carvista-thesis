import assert from "node:assert/strict";
import test from "node:test";
import { buildFitSection } from "./page_intelligence.service.js";

test("buildFitSection compacts fit reasons and caveats into buyer-friendly bullets", () => {
  const section = buildFitSection({
    name: "2013 Volkswagen Jetta SE PZEV",
    score: 62,
    fit_label: "Good fit",
    reasons: [
      "matches your family-focused use case better than a smaller body style",
      "leans toward an easier long-term ownership path",
      "shows better owner sentiment in the available local review pool",
    ],
    caveats: [
      "cargo space may feel tight for the amount of gear you plan to carry",
      "does not really meet the AWD or traction need you described",
    ],
    profile_summary: "usually 2 passengers",
  });

  assert.equal(section.title, "Fit for your needs");
  assert.equal(section.insight_cards.length, 1);
  assert.deepEqual(section.highlights, [
    "Family-friendly layout",
    "Easier long-term ownership",
    "Positive owner feedback",
  ]);
  assert.deepEqual(section.caveats, ["Tight cargo room", "AWD need unmet"]);
  assert.match(section.assistant_message, /looks like a good fit/i);
});
