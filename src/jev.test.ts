import assert from "node:assert/strict";
import {
  billToJevText,
  DEFAULT_JEV_MIN_RELEVANCE,
  documentToJevText,
  filterHighConfidenceMatches,
  formatJevBadge,
  formatJevFilterNote,
  isJevEnabled,
  newsToJevText,
  noHighConfidenceText,
  parseMinRelevance,
  selectHighConfidence,
  truncateForJev,
} from "./jev.js";

assert.equal(parseMinRelevance(undefined), DEFAULT_JEV_MIN_RELEVANCE);
assert.equal(parseMinRelevance(""), DEFAULT_JEV_MIN_RELEVANCE);
assert.equal(parseMinRelevance("0.8"), 0.8);
assert.equal(parseMinRelevance("1"), 1);
assert.equal(parseMinRelevance("0"), DEFAULT_JEV_MIN_RELEVANCE);
assert.equal(parseMinRelevance("1.2"), DEFAULT_JEV_MIN_RELEVANCE);
assert.equal(parseMinRelevance("nope"), DEFAULT_JEV_MIN_RELEVANCE);

const scored = [
  { item: "poor", relevance: 0.12 },
  { item: "borderline", relevance: 0.84 },
  { item: "strong", relevance: 0.93 },
  { item: "excellent", relevance: 0.99 },
];
const kept = selectHighConfidence(scored, 0.85);
assert.deepEqual(
  kept.map((x) => x.item),
  ["excellent", "strong"],
);
assert.equal(selectHighConfidence(scored, 0.99).length, 1);
assert.equal(selectHighConfidence(scored, 1).length, 0);

assert.equal(truncateForJev("short"), "short");
assert.equal(truncateForJev("   lots   of    space   "), "lots of space");
assert.equal(truncateForJev("abcdefghij", 6), "abcde…");
assert.equal(truncateForJev("abc", 3), "abc");

const billText = billToJevText({
  title: "Guiding and Establishing National Innovation for U.S. Stablecoins Act",
  shortTitle: "GENIUS Act",
  type: "S",
  number: 1582,
  summary: "Payment stablecoin framework.",
  latestAction: { text: "Became Public Law 119-27." },
  subjects: ["Finance and Financial Sector", { name: "Digital assets" }],
});
assert.match(billText, /GENIUS Act/);
assert.match(billText, /stablecoin/i);
assert.match(billText, /S 1582/);

const docText = documentToJevText({
  title: "Unrelated forestry notice",
  abstract: "Timber harvest schedule",
  agency_names: ["Forest Service"],
  document_type: "Notice",
});
assert.match(docText, /forestry/i);

const newsText = newsToJevText({
  source: "sec",
  title: "SEC charges crypto exchange",
  summary: "Enforcement action involving digital assets.",
});
assert.match(newsText, /\[SEC\]/);
assert.match(newsText, /crypto/);

assert.equal(formatJevBadge(false, 0.99), "");
assert.equal(formatJevBadge(true, 0.941), " (Jev 0.94)");
assert.equal(formatJevFilterNote({ applied: false, dropped: 3, minRelevance: 0.85 }), "");
assert.match(
  formatJevFilterNote({
    applied: true,
    dropped: 4,
    minRelevance: 0.85,
    model: "jev-1.13.0",
  }),
  /Dropped 4/,
);

assert.match(noHighConfidenceText("quantum computing", 7), /quantum computing/);
assert.match(noHighConfidenceText("quantum computing", 7), /7 result/);

assert.equal(isJevEnabled(), Boolean(process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY));

const passthrough = await filterHighConfidenceMatches(
  "stablecoin reserves",
  [{ title: "GENIUS Act", summary: "Payment stablecoin framework." }],
  billToJevText,
);
assert.equal(passthrough.applied, false);
assert.equal(passthrough.matches.length, 1);
assert.equal(passthrough.matches[0].item.title, "GENIUS Act");

console.log("jev unit tests passed");
