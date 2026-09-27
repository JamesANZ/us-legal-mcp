// Optional Jev (TypeSafe System One) relevance filter.
//
// When TYPESAFE_API_KEY (or JEV_API_KEY) is set, search hits are judged
// against the user's request. Only high-confidence matches are returned;
// poor / low-confidence matches are dropped. Without a key the server
// behaves as before (keyword scoring only).

import axios from "axios";

export const DEFAULT_JEV_MIN_RELEVANCE = 0.85;
export const DEFAULT_JEV_MODEL = "jev-latest";
export const DEFAULT_JEV_BASE_URL = "https://api.typesafe.ai";

const CANDIDATE_TEXT_LIMIT = 400;
const BATCH_SIZE = 16;
const REQUEST_TIMEOUT_MS = 12_000;

export interface JevMatch<T> {
  item: T;
  relevance: number;
}

export interface JevFilterResult<T> {
  matches: JevMatch<T>[];
  applied: boolean;
  considered: number;
  dropped: number;
  model?: string;
  minRelevance: number;
}

interface JevNoulAnswer {
  type?: string;
  noul?: number;
}

interface JevSystemOneResponse {
  model?: string;
  answers?: Record<string, JevNoulAnswer>;
}

export function getJevApiKey(): string | undefined {
  const key =
    process.env.TYPESAFE_API_KEY?.trim() || process.env.JEV_API_KEY?.trim();
  return key || undefined;
}

export function isJevEnabled(): boolean {
  return Boolean(getJevApiKey());
}

export function parseMinRelevance(
  raw: string | undefined,
  fallback = DEFAULT_JEV_MIN_RELEVANCE,
): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1) return fallback;
  return n;
}

export function getJevMinRelevance(): number {
  return parseMinRelevance(process.env.JEV_MIN_RELEVANCE);
}

export function truncateForJev(
  text: string,
  max = CANDIDATE_TEXT_LIMIT,
): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export function selectHighConfidence<T>(
  scored: JevMatch<T>[],
  minRelevance: number,
): JevMatch<T>[] {
  return scored
    .filter((x) => x.relevance >= minRelevance)
    .sort((a, b) => b.relevance - a.relevance);
}

export function billToJevText(bill: {
  title?: string;
  shortTitle?: string;
  type?: string;
  number?: string | number;
  summary?: string | { text?: string };
  latestAction?: { text?: string };
  subjects?: Array<string | { name?: string }>;
}): string {
  const summary =
    typeof bill.summary === "string"
      ? bill.summary
      : bill.summary?.text || "";
  const subjects = (bill.subjects || [])
    .map((s) => (typeof s === "string" ? s : s?.name || ""))
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");
  return truncateForJev(
    [
      bill.title,
      bill.shortTitle && bill.shortTitle !== bill.title
        ? `Short title: ${bill.shortTitle}`
        : "",
      bill.type && bill.number != null ? `${bill.type} ${bill.number}` : "",
      summary,
      bill.latestAction?.text ? `Latest action: ${bill.latestAction.text}` : "",
      subjects ? `Subjects: ${subjects}` : "",
    ]
      .filter(Boolean)
      .join(" — "),
  );
}

export function documentToJevText(doc: {
  title?: string;
  abstract?: string;
  document_number?: string;
  agency_names?: string[];
  document_type?: string;
}): string {
  return truncateForJev(
    [
      doc.title,
      doc.document_type,
      doc.document_number,
      (doc.agency_names || []).slice(0, 3).join(", "),
      doc.abstract,
    ]
      .filter(Boolean)
      .join(" — "),
  );
}

export function opinionToJevText(opinion: {
  case_name?: string;
  case_name_full?: string;
  court?: string;
  date_filed?: string;
  citation?: string;
  plain_text?: string;
  html?: string;
}): string {
  let excerpt = "";
  if (opinion.plain_text) {
    excerpt = opinion.plain_text;
  } else if (opinion.html) {
    excerpt = opinion.html.replace(/<[^>]*>/g, " ");
  }
  return truncateForJev(
    [
      opinion.case_name_full || opinion.case_name,
      opinion.court,
      opinion.date_filed,
      opinion.citation,
      excerpt,
    ]
      .filter(Boolean)
      .join(" — "),
  );
}

export function newsToJevText(item: {
  source?: string;
  title?: string;
  summary?: string;
  category?: string;
  date?: string;
}): string {
  return truncateForJev(
    [
      item.source ? `[${item.source.toUpperCase()}]` : "",
      item.title,
      item.category,
      item.date,
      item.summary,
    ]
      .filter(Boolean)
      .join(" — "),
  );
}

export function curatedActToJevText(act: {
  shortTitle?: string;
  fullTitle?: string;
  status?: string;
  summary?: string;
}): string {
  return truncateForJev(
    [act.shortTitle, act.fullTitle, act.status, act.summary]
      .filter(Boolean)
      .join(" — "),
  );
}

export function formatJevBadge(
  applied: boolean,
  relevance: number,
): string {
  if (!applied) return "";
  return ` (Jev ${relevance.toFixed(2)})`;
}

export function formatJevFilterNote(result: {
  applied: boolean;
  dropped: number;
  minRelevance: number;
  model?: string;
}): string {
  if (!result.applied) return "";
  const dropped =
    result.dropped > 0
      ? ` Dropped ${result.dropped} poor or low-confidence match(es).`
      : "";
  const model = result.model ? ` Model: ${result.model}.` : "";
  return `_Jev high-confidence filter on (min relevance ${result.minRelevance.toFixed(2)}).${dropped}${model}_`;
}

export function noHighConfidenceText(
  query: string,
  considered: number,
): string {
  return (
    `**No high-confidence matches for "${query}"**\n\n` +
    `Jev reviewed ${considered} result(s) from the data sources and dropped ` +
    `them as poor or low-confidence matches. Try a more specific query, or ` +
    `unset TYPESAFE_API_KEY / JEV_API_KEY to disable this filter.`
  );
}

function questionForIndex(index: number): {
  type: "noul";
  instructions: string;
  criteria: { true: string; false: string };
} {
  return {
    type: "noul",
    instructions:
      `Does results[${index}] match the user's request? ` +
      `Answer true only if the result is clearly about the same legal topic or question. ` +
      `Answer false if it is unrelated, only shares a generic word, or is a poor match.`,
    criteria: {
      true: "The result is a strong, on-topic match for the user's request.",
      false: "The result is unrelated, incidental, or a poor match.",
    },
  };
}

async function scoreBatch(
  query: string,
  texts: string[],
  apiKey: string,
): Promise<{ scores: number[]; model?: string }> {
  const questions: Record<string, ReturnType<typeof questionForIndex>> = {};
  for (let i = 0; i < texts.length; i++) {
    questions[`r${i}`] = questionForIndex(i);
  }

  const baseURL = (
    process.env.TYPESAFE_BASE_URL ||
    process.env.JEV_BASE_URL ||
    DEFAULT_JEV_BASE_URL
  ).replace(/\/$/, "");
  const model = process.env.JEV_MODEL || DEFAULT_JEV_MODEL;

  const response = await axios.post<JevSystemOneResponse>(
    `${baseURL}/v1/systemone`,
    {
      model,
      state: {
        user_request: query,
        results: texts,
      },
      questions,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: (s) => s < 500,
    },
  );

  if (response.status >= 400) {
    const detail =
      typeof response.data === "object"
        ? JSON.stringify(response.data)
        : String(response.data);
    throw new Error(`Jev HTTP ${response.status}: ${detail}`);
  }

  const answers = response.data.answers || {};
  const scores = texts.map((_, i) => {
    const noul = answers[`r${i}`]?.noul;
    return typeof noul === "number" && Number.isFinite(noul) ? noul : 0;
  });

  return { scores, model: response.data.model };
}

/**
 * Judge candidates against the user request and keep only high-confidence
 * matches. If Jev is not configured, or the call fails, returns the original
 * items so the MCP tools keep working without a key.
 */
export async function filterHighConfidenceMatches<T>(
  query: string,
  items: T[],
  toText: (item: T) => string,
): Promise<JevFilterResult<T>> {
  const minRelevance = getJevMinRelevance();
  const passthrough = (applied: boolean): JevFilterResult<T> => ({
    matches: items.map((item) => ({ item, relevance: 1 })),
    applied,
    considered: items.length,
    dropped: 0,
    minRelevance,
  });

  if (!query.trim() || items.length === 0 || !isJevEnabled()) {
    return passthrough(false);
  }

  const apiKey = getJevApiKey();
  if (!apiKey) return passthrough(false);

  try {
    const texts = items.map((item) => toText(item));
    const allScores: number[] = new Array(items.length);
    let model: string | undefined;

    for (let start = 0; start < items.length; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE, items.length);
      const { scores, model: batchModel } = await scoreBatch(
        query,
        texts.slice(start, end),
        apiKey,
      );
      if (batchModel) model = batchModel;
      for (let i = 0; i < scores.length; i++) {
        allScores[start + i] = scores[i];
      }
    }

    const scored: JevMatch<T>[] = items.map((item, i) => ({
      item,
      relevance: allScores[i] ?? 0,
    }));

    const kept = selectHighConfidence(scored, minRelevance);
    console.error(
      `Jev filter: kept ${kept.length}/${items.length} ` +
        `(min ${minRelevance.toFixed(2)}; ` +
        `top ${scored
          .slice()
          .sort((a, b) => b.relevance - a.relevance)
          .slice(0, 3)
          .map((s) => s.relevance.toFixed(2))
          .join(", ")})`,
    );

    return {
      matches: kept,
      applied: true,
      considered: items.length,
      dropped: items.length - kept.length,
      model,
      minRelevance,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Jev filter failed; returning unfiltered keyword results: ${message}`,
    );
    return passthrough(false);
  }
}

export function mergeJevNotes(
  parts: Array<{
    applied: boolean;
    dropped: number;
    minRelevance: number;
    model?: string;
    considered: number;
  }>,
): string {
  const applied = parts.filter((p) => p.applied);
  if (applied.length === 0) return "";
  const dropped = applied.reduce((n, p) => n + p.dropped, 0);
  const considered = applied.reduce((n, p) => n + p.considered, 0);
  const model = applied.find((p) => p.model)?.model;
  return formatJevFilterNote({
    applied: true,
    dropped,
    minRelevance: applied[0].minRelevance,
    model: model
      ? `${model}; reviewed ${considered} candidate(s)`
      : undefined,
  });
}
