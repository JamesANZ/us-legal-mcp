// Tiny RSS / Atom feed helper.
// Wraps fast-xml-parser and normalizes items into a single shape we can use
// across regulator clients (OCC, SEC, CFTC, Fed, Treasury, FinCEN).

import axios from "axios";
import { XMLParser } from "fast-xml-parser";

export interface FeedItem {
  title: string;
  link: string;
  date?: string; // ISO8601 when parseable, otherwise raw string
  summary?: string;
  category?: string;
  guid?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: true,
  parseAttributeValue: false,
  processEntities: true,
  htmlEntities: true,
});

function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function toText(value: any): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(" ");
  if (typeof value === "object") {
    if (typeof value["#text"] === "string") return value["#text"];
    // CDATA or nested text
    return Object.values(value).map(toText).filter(Boolean).join(" ");
  }
  return "";
}

function normalizeDate(raw: any): string | undefined {
  const s = toText(raw);
  if (!s) return undefined;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return s;
}

function extractAtomLink(link: any): string {
  if (!link) return "";
  if (typeof link === "string") return link;
  if (Array.isArray(link)) {
    // Prefer rel="alternate" or the first with href
    const alt = link.find(
      (l: any) =>
        l &&
        typeof l === "object" &&
        (l["@_rel"] === "alternate" || !l["@_rel"]),
    );
    if (alt?.["@_href"]) return alt["@_href"];
    const withHref = link.find((l: any) => l?.["@_href"]);
    if (withHref?.["@_href"]) return withHref["@_href"];
    // Fall back to text content
    return toText(link);
  }
  if (typeof link === "object") {
    if (link["@_href"]) return link["@_href"];
    return toText(link);
  }
  return String(link);
}

export async function fetchFeed(
  url: string,
  options?: { userAgent?: string; timeoutMs?: number },
): Promise<FeedItem[]> {
  const headers: Record<string, string> = {
    // Many federal sites reject default user agents (notably sec.gov).
    "User-Agent":
      options?.userAgent ||
      "us-legal-mcp/1.1 (+https://github.com/JamesANZ/legal-mcp; contact: legal-mcp@example.com)",
    Accept:
      "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  };
  // Default to 8s: long enough for a slow RSS fetch, short enough that the
  // enclosing MCP tool call doesn't exceed a typical MCP client timeout
  // (Cursor, Claude Desktop, etc.). Callers may override via options.
  const response = await axios.get(url, {
    headers,
    timeout: options?.timeoutMs ?? 8000,
    responseType: "text",
    transformResponse: (data) => data,
    validateStatus: (s) => s < 500,
  });
  if (response.status >= 400) {
    throw new Error(`Feed ${url} returned ${response.status}`);
  }
  const data = parser.parse(response.data);

  // RSS 2.0
  const rssItems = data?.rss?.channel?.item;
  if (rssItems) {
    const arr = Array.isArray(rssItems) ? rssItems : [rssItems];
    return arr.map((it: any) => ({
      title: stripHtml(toText(it.title)),
      link: toText(it.link),
      date: normalizeDate(it.pubDate || it["dc:date"] || it.date),
      summary: stripHtml(
        toText(it.description || it.summary || it["content:encoded"]),
      ),
      category: Array.isArray(it.category)
        ? it.category.map(toText).join(", ")
        : toText(it.category) || undefined,
      guid: toText(it.guid) || undefined,
    }));
  }

  // Atom
  const atomEntries = data?.feed?.entry;
  if (atomEntries) {
    const arr = Array.isArray(atomEntries) ? atomEntries : [atomEntries];
    return arr.map((it: any) => ({
      title: stripHtml(toText(it.title)),
      link: extractAtomLink(it.link),
      date: normalizeDate(it.updated || it.published || it.date),
      summary: stripHtml(toText(it.summary || it.content)),
      category: Array.isArray(it.category)
        ? it.category
            .map((c: any) => c?.["@_term"] || toText(c))
            .filter(Boolean)
            .join(", ")
        : it.category?.["@_term"] || toText(it.category) || undefined,
      guid: toText(it.id) || undefined,
    }));
  }

  return [];
}

// Simple relevance scoring reused across regulator search tools.
// Counts query-term occurrences in title + summary; title matches weighted heavier.
export function scoreFeedItem(item: FeedItem, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return 0;
  const title = (item.title || "").toLowerCase();
  const summary = (item.summary || "").toLowerCase();

  let score = 0;
  if (title.includes(q)) score += 20;
  if (summary.includes(q)) score += 5;
  for (const t of terms) {
    const titleMatches = (title.match(new RegExp(t, "g")) || []).length;
    const summaryMatches = (summary.match(new RegExp(t, "g")) || []).length;
    score += Math.min(titleMatches, 5) * 3;
    score += Math.min(summaryMatches, 5) * 1;
  }
  return score;
}

export function filterAndRank(
  items: FeedItem[],
  query: string | undefined,
  limit: number,
): FeedItem[] {
  if (!query) {
    return items.slice(0, limit);
  }
  const scored = items
    .map((it) => ({ it, score: scoreFeedItem(it, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.it);
}
