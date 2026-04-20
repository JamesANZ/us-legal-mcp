// US Legal APIs Integration
// Comprehensive integration with US government legal data sources

import axios from "axios";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fetchFeed, filterAndRank, FeedItem } from "./rss.js";

const execFileAsync = promisify(execFile);

// Some federal sites (notably cftc.gov) sit behind Cloudflare and reject
// Node's TLS fingerprint regardless of User-Agent. curl, however, is almost
// universally available and works. This helper shells out to curl and returns
// the response body as a string; throws on non-2xx.
async function fetchViaCurl(url: string, userAgent?: string): Promise<string> {
  const ua =
    userAgent ||
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15";
  const { stdout } = await execFileAsync(
    "curl",
    [
      "-s",
      "-L",
      "--max-time",
      "20",
      "-A",
      ua,
      "-H",
      "Accept: application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*",
      "--fail-with-body",
      url,
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  return stdout;
}

// Relevance scoring utilities
function calculateRelevanceScore(text: string, query: string): number {
  if (!text || !query) return 0;

  const lowerText = text.toLowerCase();
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);

  if (queryTerms.length === 0) return 0;

  let score = 0;
  const exactMatch = lowerText.includes(query.toLowerCase());
  if (exactMatch) score += 10;

  // Count how many query terms appear
  let matchedTerms = 0;
  for (const term of queryTerms) {
    if (lowerText.includes(term)) {
      matchedTerms++;
      // Bonus for term appearing multiple times
      const occurrences = (lowerText.match(new RegExp(term, "g")) || []).length;
      score += Math.min(occurrences, 3);
    }
  }

  // Bonus for all terms matching
  if (matchedTerms === queryTerms.length) score += 5;

  // Bonus for title/short title match (handled in specific scoring functions)
  return score;
}

function scoreBillRelevance(bill: any, query: string): number {
  let score = 0;
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((term) => term.length > 2);

  // High weight for title matches
  if (bill.title) {
    const titleScore = calculateRelevanceScore(bill.title, query);
    score += titleScore * 4; // Increased from 3
  }

  if (bill.shortTitle) {
    const shortTitleScore = calculateRelevanceScore(bill.shortTitle, query);
    score += shortTitleScore * 4; // Increased from 3
  }

  // Medium weight for summary
  if (bill.summary?.text) {
    score += calculateRelevanceScore(bill.summary.text, query) * 2;
  }

  // Check latest action text
  if (bill.latestAction?.text) {
    const actionScore = calculateRelevanceScore(bill.latestAction.text, query);
    score += actionScore * 1.5;
  }

  // Enhanced subject/topic matching - check each query term individually
  if (bill.subjects && queryTerms.length > 0) {
    for (const subject of bill.subjects) {
      const subjectName = (
        typeof subject === "string" ? subject : subject.name || ""
      ).toLowerCase();

      // Check if any query term matches the subject
      for (const term of queryTerms) {
        if (subjectName.includes(term)) {
          score += 20; // Increased from 15
          break; // Only count once per subject
        }
      }
    }
  }

  return score;
}

function scoreDocumentRelevance(doc: any, query: string): number {
  let score = 0;

  // High weight for title
  if (doc.title) {
    score += calculateRelevanceScore(doc.title, query) * 3;
  }

  // Medium weight for abstract
  if (doc.abstract) {
    score += calculateRelevanceScore(doc.abstract, query) * 2;
  }

  // Check agency names for relevance by matching query terms against agency names
  if (doc.agency_names && Array.isArray(doc.agency_names)) {
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 2);
    for (const agency of doc.agency_names) {
      const agencyLower = agency.toLowerCase();
      // Check if any query term appears in the agency name
      const agencyMatch = queryTerms.some((term) => agencyLower.includes(term));
      if (agencyMatch) {
        score += 10;
      }
    }
  }

  return score;
}

// API Base URLs
export const API_ENDPOINTS = {
  CONGRESS: "https://api.congress.gov/v3",
  FEDERAL_REGISTER: "https://www.federalregister.gov/api/v1",
  US_CODE: "https://uscode.house.gov/api",
  REGULATIONS_GOV: "https://api.regulations.gov/v4",
  GPO: "https://api.govinfo.gov",
  GOVINFO: "https://api.govinfo.gov",
  COURT_LISTENER: "https://www.courtlistener.com/api/rest/v3",
  OCC_API: "https://api.occ.gov",
  OCC_RSS: "https://www.occ.gov/rss",
  SEC_PRESS_RSS:
    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=&company=&dateb=&owner=include&count=40&output=atom",
  SEC_PRESS_NEWS_RSS: "https://www.sec.gov/news/pressreleases.rss",
  CFTC_RSS_GENERAL: "https://www.cftc.gov/RSS/RSSGP/rssgp.xml",
  CFTC_RSS_ENFORCEMENT: "https://www.cftc.gov/RSS/RSSENF/rssenf.xml",
  CFTC_RSS_SPEECHES: "https://www.cftc.gov/RSS/RSSST/rssst.xml",
  FED_PRESS_ALL_RSS: "https://www.federalreserve.gov/feeds/press_all.xml",
  TREASURY_PRESS_RSS: "https://home.treasury.gov/rss/press",
  FINCEN_NEWS_RSS: "https://www.fincen.gov/news/news-releases/feed",
} as const;

// Types for US Legal Data
export interface CongressBill {
  congress: number;
  type: string;
  number: number;
  title: string;
  shortTitle?: string;
  summary?: string;
  url: string;
  introducedDate: string;
  latestAction?: {
    actionDate: string;
    text: string;
  };
  subjects?: string[];
  sponsors?: Array<{
    bioguideId: string;
    firstName: string;
    lastName: string;
    party: string;
    state: string;
  }>;
}

export interface FederalRegisterDocument {
  document_number: string;
  title: string;
  abstract?: string;
  publication_date: string;
  effective_date?: string;
  agency_names: string[];
  document_type: string;
  pdf_url: string;
  html_url: string;
  json_url: string;
  sections?: Array<{
    title: string;
    content: string;
  }>;
}

export interface USCodeSection {
  title: number;
  section: string;
  text: string;
  url: string;
  last_updated: string;
  source: string;
}

export interface RegulationComment {
  id: string;
  comment: string;
  posted_date: string;
  agency_id: string;
  document_id: string;
  submitter_name?: string;
  organization?: string;
}

export interface CourtOpinion {
  id: number;
  case_name: string;
  case_name_full?: string;
  date_filed: string;
  date_modified?: string;
  court: string;
  court_id: number;
  jurisdiction: string;
  citation?: string;
  citation_count?: number;
  precedential_status: string;
  url: string;
  absolute_url: string;
  download_url?: string;
  plain_text?: string;
  html?: string;
  html_lawbox?: string;
  html_columbia?: string;
  html_anon_2020?: string;
  judges?: string[];
  docket?: string;
  docket_number?: string;
  slug?: string;
}

export interface CongressVote {
  rollNumber: number;
  url: string;
  voteDate: string;
  voteQuestion: string;
  voteResult: string;
  voteTitle: string;
  voteType: string;
  chamber: string;
  congress: number;
  session: number;
  members?: Array<{
    member: {
      bioguideId: string;
      firstName: string;
      lastName: string;
      party: string;
      state: string;
    };
    votePosition: string;
  }>;
}

export interface Committee {
  systemCode: string;
  name: string;
  url: string;
  chamber?: string;
  committeeType?: string;
  subcommittees?: Array<{
    systemCode: string;
    name: string;
    url: string;
  }>;
}

export interface BillAction {
  actionDate: string;
  actionTime?: string;
  text: string;
  type?: string;
  actionCode?: string;
  sourceSystem?: {
    code?: number;
    name?: string;
  };
  committees?: Array<{
    name: string;
    systemCode?: string;
    url?: string;
  }>;
  recordedVotes?: Array<{
    chamber?: string;
    congress?: number;
    date?: string;
    rollNumber?: number;
    sessionNumber?: number;
    url?: string;
  }>;
}

export interface BillTextVersion {
  type: string; // e.g. "Enrolled Bill", "Engrossed in House", "Introduced in Senate"
  date?: string;
  formats: Array<{
    type: string; // "Formatted Text" | "PDF" | "Formatted XML"
    url: string;
  }>;
}

export interface PublicLawPackage {
  packageId: string;
  title: string;
  publicLawNumber?: string;
  congress?: number;
  dateIssued?: string;
  docClass?: string;
  category?: string;
  branch?: string;
  pages?: number;
  summaryUrl: string;
  htmlUrl?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  txtUrl?: string;
  abstract?: string;
}

export interface RegulatorNewsItem {
  source: string; // "occ" | "sec" | "cftc" | "fed" | "treasury"
  title: string;
  link: string;
  date?: string;
  summary?: string;
  category?: string;
}

// Parse a canonical bill id like "s1582-119" or "hr3633-119" into its parts.
// Also accepts uppercase variants and bill types like "sres", "hres", "sjres", "hjres", "sconres", "hconres".
export function parseBillId(billId: string): {
  congress: number;
  type: string;
  number: number;
} | null {
  if (!billId) return null;
  const m = billId
    .trim()
    .toLowerCase()
    .match(/^(hr|s|hres|sres|hjres|sjres|hconres|sconres)(\d+)-(\d{2,3})$/);
  if (!m) return null;
  return {
    type: m[1],
    number: parseInt(m[2], 10),
    congress: parseInt(m[3], 10),
  };
}

// Congress.gov API Functions
export class CongressAPI {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CONGRESS_API_KEY || "";
  }

  async searchBills(
    query: string,
    congress?: number,
    limit: number = 20,
    options?: { strict?: boolean; minScore?: number },
  ): Promise<CongressBill[]> {
    try {
      // Get more results than needed for filtering.
      // In strict mode we pull a larger window because the /bill endpoint
      // silently ignores the `q` param - we have to filter client-side.
      const strict = options?.strict === true;
      const minScore = options?.minScore ?? (strict ? 8 : 5);
      const fetchLimit = Math.min(limit * (strict ? 12 : 5), 250);

      // Default to the current Congress when strict: keyword-less listings
      // from earlier Congresses are almost always noise for current-policy
      // queries (e.g. stablecoin / digital asset).
      const effectiveCongress = congress ?? (strict ? 119 : undefined);

      const params = new URLSearchParams({
        q: query,
        limit: fetchLimit.toString(),
        format: "json",
        sort: "updateDate+desc",
        ...(this.apiKey && { api_key: this.apiKey }),
        ...(effectiveCongress && { congress: effectiveCongress.toString() }),
      });

      const baseUrl = effectiveCongress
        ? `${API_ENDPOINTS.CONGRESS}/bill/${effectiveCongress}`
        : `${API_ENDPOINTS.CONGRESS}/bill`;

      const response = await axios.get(`${baseUrl}?${params}`);

      const bills = (response.data.bills || []).map((bill: any) => ({
        congress: bill.congress,
        type: bill.type,
        number: bill.number,
        title: bill.title,
        shortTitle: bill.shortTitle,
        summary: bill.summary?.text,
        url: bill.url,
        introducedDate: bill.introducedDate,
        latestAction: bill.latestAction
          ? {
              actionDate: bill.latestAction.actionDate,
              text: bill.latestAction.text,
            }
          : undefined,
        subjects: bill.subjects?.map((s: any) => s.name || s),
        sponsors: bill.sponsors?.map((s: any) => ({
          bioguideId: s.bioguideId,
          firstName: s.firstName,
          lastName: s.lastName,
          party: s.party,
          state: s.state,
        })),
      }));

      // Score and sort by relevance
      const scoredBills = bills.map((bill: any) => ({
        ...bill,
        relevanceScore: scoreBillRelevance(bill, query),
      }));

      // Sort by relevance (highest first)
      scoredBills.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

      // Log scoring for debugging (first few bills)
      if (scoredBills.length > 0) {
        console.error(
          `Congress Bills Relevance Scores (top 5): ${scoredBills
            .slice(0, 5)
            .map(
              (b: any) =>
                `${b.title.substring(0, 40)}... (score: ${b.relevanceScore})`,
            )
            .join(", ")}`,
        );
      }

      // Use smart filtering: prioritize high-scoring bills but always return top results
      // Only filter if we have many high-scoring options
      const highRelevanceBills = scoredBills.filter(
        (bill: any) => bill.relevanceScore >= minScore,
      );

      if (strict) {
        // Strict mode: never pad with low-score noise. Return only bills
        // that actually matched the query (or an empty array).
        return highRelevanceBills
          .slice(0, limit)
          .map(({ relevanceScore, ...bill }: any) => bill);
      }

      if (highRelevanceBills.length >= limit) {
        // We have enough high-relevance results, return those
        return highRelevanceBills
          .slice(0, limit)
          .map(({ relevanceScore, ...bill }: any) => bill);
      } else if (scoredBills.length > 0) {
        // Return top results sorted by relevance, even if scores are low
        // This ensures we always return something if the API returned results
        return scoredBills
          .slice(0, limit)
          .map(({ relevanceScore, ...bill }: any) => bill);
      }

      return [];
    } catch (error) {
      console.error("Congress API error:", error);
      return [];
    }
  }

  async getBillDetails(
    congress: number,
    billType: string,
    billNumber: number,
  ): Promise<CongressBill | null> {
    try {
      const params = new URLSearchParams({
        format: "json",
        ...(this.apiKey && { api_key: this.apiKey }),
      });

      const response = await axios.get(
        `${API_ENDPOINTS.CONGRESS}/bill/${congress}/${billType}/${billNumber}?${params}`,
      );

      const bill = response.data.bill;
      // NOTE: The single-bill endpoint returns `subjects` as
      // `{count, url, policyArea, legislativeSubjects?}` rather than the
      // array you get from /bill?... So we normalize both shapes here.
      let subjects: string[] | undefined;
      if (Array.isArray(bill.subjects)) {
        subjects = bill.subjects
          .map((s: any) => (typeof s === "string" ? s : s?.name))
          .filter(Boolean);
      } else if (bill.subjects && typeof bill.subjects === "object") {
        const collected: string[] = [];
        if (bill.subjects.policyArea?.name) {
          collected.push(bill.subjects.policyArea.name);
        }
        if (Array.isArray(bill.subjects.legislativeSubjects)) {
          for (const s of bill.subjects.legislativeSubjects) {
            if (s?.name) collected.push(s.name);
          }
        }
        subjects = collected.length ? collected : undefined;
      }
      return {
        congress: bill.congress,
        type: bill.type,
        number: bill.number,
        title: bill.title,
        shortTitle: bill.shortTitle,
        summary: bill.summary?.text,
        url: bill.url,
        introducedDate: bill.introducedDate,
        latestAction: bill.latestAction
          ? {
              actionDate: bill.latestAction.actionDate,
              text: bill.latestAction.text,
            }
          : undefined,
        subjects,
        sponsors: bill.sponsors?.map((s: any) => ({
          bioguideId: s.bioguideId,
          firstName: s.firstName,
          lastName: s.lastName,
          party: s.party,
          state: s.state,
        })),
      };
    } catch (error) {
      console.error("Congress API error:", error);
      return null;
    }
  }

  async getRecentBills(
    congress?: number,
    limit: number = 20,
  ): Promise<CongressBill[]> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        format: "json",
        ...(this.apiKey && { api_key: this.apiKey }),
        ...(congress && { congress: congress.toString() }),
      });

      const response = await axios.get(
        `${API_ENDPOINTS.CONGRESS}/bill?${params}`,
      );

      return (
        response.data.bills?.map((bill: any) => ({
          congress: bill.congress,
          type: bill.type,
          number: bill.number,
          title: bill.title,
          shortTitle: bill.shortTitle,
          summary: bill.summary?.text,
          url: bill.url,
          introducedDate: bill.introducedDate,
          latestAction: bill.latestAction
            ? {
                actionDate: bill.latestAction.actionDate,
                text: bill.latestAction.text,
              }
            : undefined,
          subjects: bill.subjects?.map((s: any) => s.name),
          sponsors: bill.sponsors?.map((s: any) => ({
            bioguideId: s.bioguideId,
            firstName: s.firstName,
            lastName: s.lastName,
            party: s.party,
            state: s.state,
          })),
        })) || []
      );
    } catch (error) {
      console.error("Congress API error:", error);
      return [];
    }
  }

  async searchVotes(
    congress?: number,
    chamber?: "House" | "Senate",
    limit: number = 20,
  ): Promise<CongressVote[]> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        format: "json",
        ...(this.apiKey && { api_key: this.apiKey }),
        ...(congress && { congress: congress.toString() }),
        ...(chamber && { chamber }),
      });

      const response = await axios.get(
        `${API_ENDPOINTS.CONGRESS}/vote?${params}`,
      );

      return (
        response.data.votes?.map((vote: any) => ({
          rollNumber: vote.rollNumber,
          url: vote.url,
          voteDate: vote.voteDate,
          voteQuestion: vote.voteQuestion,
          voteResult: vote.voteResult,
          voteTitle: vote.voteTitle,
          voteType: vote.voteType,
          chamber: vote.chamber,
          congress: vote.congress,
          session: vote.session,
          members: vote.members?.map((m: any) => ({
            member: {
              bioguideId: m.member?.bioguideId,
              firstName: m.member?.firstName,
              lastName: m.member?.lastName,
              party: m.member?.party,
              state: m.member?.state,
            },
            votePosition: m.votePosition,
          })),
        })) || []
      );
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.error(
          "Congress API: API key required for votes/committees. Get one at https://api.congress.gov/",
        );
      } else {
        console.error("Congress API error:", error.message || error);
      }
      return [];
    }
  }

  // Raw bill details (includes sponsors, cosponsors, actions ref, subjects, etc.).
  // Returns the raw API payload for maximum fidelity; the caller can project what it needs.
  async getBill(
    congress: number,
    type: string,
    number: number,
  ): Promise<any | null> {
    try {
      const params = new URLSearchParams({
        format: "json",
        ...(this.apiKey && { api_key: this.apiKey }),
      });
      const billType = type.toLowerCase();
      const response = await axios.get(
        `${API_ENDPOINTS.CONGRESS}/bill/${congress}/${billType}/${number}?${params}`,
      );
      return response.data?.bill ?? null;
    } catch (error: any) {
      console.error("Congress API getBill error:", error.message || error);
      return null;
    }
  }

  async getBillActions(
    congress: number,
    type: string,
    number: number,
    limit: number = 50,
  ): Promise<BillAction[]> {
    try {
      const params = new URLSearchParams({
        format: "json",
        limit: Math.min(limit, 250).toString(),
        ...(this.apiKey && { api_key: this.apiKey }),
      });
      const billType = type.toLowerCase();
      const response = await axios.get(
        `${API_ENDPOINTS.CONGRESS}/bill/${congress}/${billType}/${number}/actions?${params}`,
      );
      const actions: BillAction[] = (response.data?.actions || []).map(
        (a: any) => ({
          actionDate: a.actionDate,
          actionTime: a.actionTime,
          text: a.text,
          type: a.type,
          actionCode: a.actionCode,
          sourceSystem: a.sourceSystem
            ? { code: a.sourceSystem.code, name: a.sourceSystem.name }
            : undefined,
          committees: a.committees?.map((c: any) => ({
            name: c.name,
            systemCode: c.systemCode,
            url: c.url,
          })),
          recordedVotes: a.recordedVotes?.map((v: any) => ({
            chamber: v.chamber,
            congress: v.congress,
            date: v.date,
            rollNumber: v.rollNumber,
            sessionNumber: v.sessionNumber,
            url: v.url,
          })),
        }),
      );
      // Sort newest first (API is usually newest-first already but guarantee it)
      actions.sort((a, b) =>
        (b.actionDate || "").localeCompare(a.actionDate || ""),
      );
      return actions;
    } catch (error: any) {
      console.error(
        "Congress API getBillActions error:",
        error.message || error,
      );
      return [];
    }
  }

  async getBillTextVersions(
    congress: number,
    type: string,
    number: number,
  ): Promise<BillTextVersion[]> {
    try {
      const params = new URLSearchParams({
        format: "json",
        ...(this.apiKey && { api_key: this.apiKey }),
      });
      const billType = type.toLowerCase();
      const response = await axios.get(
        `${API_ENDPOINTS.CONGRESS}/bill/${congress}/${billType}/${number}/text?${params}`,
      );
      return (response.data?.textVersions || []).map((v: any) => ({
        type: v.type,
        date: v.date,
        formats: (v.formats || []).map((f: any) => ({
          type: f.type,
          url: f.url,
        })),
      }));
    } catch (error: any) {
      console.error(
        "Congress API getBillTextVersions error:",
        error.message || error,
      );
      return [];
    }
  }

  async getCommittees(
    congress?: number,
    chamber?: "House" | "Senate",
  ): Promise<Committee[]> {
    try {
      const params = new URLSearchParams({
        format: "json",
        ...(this.apiKey && { api_key: this.apiKey }),
        ...(congress && { congress: congress.toString() }),
        ...(chamber && { chamber }),
      });

      const response = await axios.get(
        `${API_ENDPOINTS.CONGRESS}/committee?${params}`,
      );

      return (
        response.data.committees?.map((committee: any) => ({
          systemCode: committee.systemCode,
          name: committee.name,
          url: committee.url,
          chamber: committee.chamber,
          committeeType: committee.committeeType,
          subcommittees: committee.subcommittees?.map((sub: any) => ({
            systemCode: sub.systemCode,
            name: sub.name,
            url: sub.url,
          })),
        })) || []
      );
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.error(
          "Congress API: API key required for votes/committees. Get one at https://api.congress.gov/",
        );
      } else {
        console.error("Congress API error:", error.message || error);
      }
      return [];
    }
  }
}

// GovInfo API Functions (api.govinfo.gov)
// Docs: https://api.govinfo.gov/docs/
// Requires an api.data.gov key (free). Falls back to DEMO_KEY (rate-limited) when none provided.
export class GovInfoAPI {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOVINFO_API_KEY || "DEMO_KEY";
  }

  private keyParams(): URLSearchParams {
    return new URLSearchParams({ api_key: this.apiKey });
  }

  // Public Law package id shape: PLAW-{congress}publ{lawNumber}
  // Example: GENIUS Act (Pub. L. 119-27) = PLAW-119publ27
  buildPublicLawPackageId(congress: number, lawNumber: number): string {
    return `PLAW-${congress}publ${lawNumber}`;
  }

  // Bill package id shape: BILLS-{congress}{type}{number}{stage}
  // stage examples: ih (introduced house), is (introduced senate), rh (reported house),
  //                 eh (engrossed house), es (engrossed senate), enr (enrolled),
  //                 rfs (referred to senate), pcs (placed on calendar senate), etc.
  buildBillPackageId(
    congress: number,
    type: string,
    number: number,
    stage: string = "enr",
  ): string {
    return `BILLS-${congress}${type.toLowerCase()}${number}${stage.toLowerCase()}`;
  }

  async getPackageSummary(packageId: string): Promise<PublicLawPackage | null> {
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.GOVINFO}/packages/${packageId}/summary?${this.keyParams()}`,
        { timeout: 20000 },
      );
      const d = response.data || {};
      const download = d.download || {};
      return {
        packageId: d.packageId || packageId,
        title: d.title || "",
        publicLawNumber: d.publicLawNumber,
        congress: d.congress ? parseInt(d.congress, 10) : undefined,
        dateIssued: d.dateIssued,
        docClass: d.docClass,
        category: d.category,
        branch: d.branch,
        pages: d.pages,
        summaryUrl: `${API_ENDPOINTS.GOVINFO}/packages/${packageId}/summary`,
        htmlUrl: download.htmLink || download.txtLink,
        pdfUrl: download.pdfLink,
        xmlUrl: download.xmlLink || download.uslmLink,
        txtUrl: download.txtLink,
        abstract: d.abstract,
      };
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.error(
          "GovInfo API: rate-limited. Set GOVINFO_API_KEY to your api.data.gov key for higher limits.",
        );
      } else if (error.response?.status === 404) {
        console.error(`GovInfo API: package not found: ${packageId}`);
      } else {
        console.error(
          "GovInfo API error:",
          error.response?.status,
          error.message || error,
        );
      }
      return null;
    }
  }

  // Fetch the plain-text content of a package (HTM -> text).
  // Returns truncated text so we don't explode MCP responses. Caller can raise `maxChars`.
  async getPackageText(
    packageId: string,
    maxChars: number = 20000,
  ): Promise<string | null> {
    try {
      // Try htm first, fall back to txt
      for (const fmt of ["htm", "txt"] as const) {
        try {
          const response = await axios.get(
            `${API_ENDPOINTS.GOVINFO}/packages/${packageId}/${fmt}?${this.keyParams()}`,
            {
              timeout: 30000,
              responseType: "text",
              transformResponse: (data) => data, // keep raw
            },
          );
          let text: string = response.data || "";
          if (fmt === "htm") {
            text = text
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
          if (!text) continue;
          if (text.length > maxChars) {
            text = text.substring(0, maxChars) + "\n\n...[truncated]";
          }
          return text;
        } catch {
          // try next format
        }
      }
      return null;
    } catch (error: any) {
      console.error(
        "GovInfo API getPackageText error:",
        error.message || error,
      );
      return null;
    }
  }

  async getPublicLaw(
    congress: number,
    lawNumber: number,
  ): Promise<PublicLawPackage | null> {
    const packageId = this.buildPublicLawPackageId(congress, lawNumber);
    return this.getPackageSummary(packageId);
  }
}

// Federal Register API Functions
export class FederalRegisterAPI {
  async searchDocuments(
    query: string,
    limit: number = 20,
  ): Promise<FederalRegisterDocument[]> {
    try {
      // Get more results than needed for filtering
      const fetchLimit = Math.min(limit * 3, 100);

      // Federal Register has two search modes:
      //   q=...                  → fuzzy relevance-ranked (noisy)
      //   conditions[term]=...   → proper keyword search over title + full text
      // The conditions[term] form is strictly better for our use case.
      const params = new URLSearchParams({
        "conditions[term]": query,
        per_page: fetchLimit.toString(),
        order: "relevance",
      });

      const response = await axios.get(
        `${API_ENDPOINTS.FEDERAL_REGISTER}/documents?${params}`,
      );

      const documents = (response.data.results || []).map((doc: any) => ({
        document_number: doc.document_number,
        title: doc.title,
        abstract: doc.abstract,
        publication_date: doc.publication_date,
        effective_date: doc.effective_date,
        agency_names: doc.agency_names,
        document_type: doc.document_type,
        pdf_url: doc.pdf_url,
        html_url: doc.html_url,
        json_url: doc.json_url,
      }));

      // Score and sort by relevance
      const scoredDocs = documents.map((doc: any) => ({
        ...doc,
        relevanceScore: scoreDocumentRelevance(doc, query),
      }));

      // Sort by relevance (highest first)
      scoredDocs.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

      // Filter out very low relevance results (score < 5) and return top results
      const relevantDocs = scoredDocs
        .filter((doc: any) => doc.relevanceScore >= 5)
        .slice(0, limit)
        .map(({ relevanceScore, ...doc }: any) => doc); // Remove score from output

      // If we filtered out too many, return the top results even if low score
      if (relevantDocs.length < limit && scoredDocs.length > 0) {
        return scoredDocs
          .slice(0, limit)
          .map(({ relevanceScore, ...doc }: any) => doc);
      }

      return relevantDocs;
    } catch (error) {
      console.error("Federal Register API error:", error);
      return [];
    }
  }

  async getRecentDocuments(
    limit: number = 20,
  ): Promise<FederalRegisterDocument[]> {
    try {
      const params = new URLSearchParams({
        per_page: limit.toString(),
        order: "newest",
      });

      const response = await axios.get(
        `${API_ENDPOINTS.FEDERAL_REGISTER}/documents?${params}`,
      );

      return (
        response.data.results?.map((doc: any) => ({
          document_number: doc.document_number,
          title: doc.title,
          abstract: doc.abstract,
          publication_date: doc.publication_date,
          effective_date: doc.effective_date,
          agency_names: doc.agency_names,
          document_type: doc.document_type,
          pdf_url: doc.pdf_url,
          html_url: doc.html_url,
          json_url: doc.json_url,
        })) || []
      );
    } catch (error) {
      console.error("Federal Register API error:", error);
      return [];
    }
  }

  async getDocumentDetails(
    documentNumber: string,
  ): Promise<FederalRegisterDocument | null> {
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.FEDERAL_REGISTER}/documents/${documentNumber}.json`,
      );

      const doc = response.data;
      return {
        document_number: doc.document_number,
        title: doc.title,
        abstract: doc.abstract,
        publication_date: doc.publication_date,
        effective_date: doc.effective_date,
        agency_names: doc.agency_names,
        document_type: doc.document_type,
        pdf_url: doc.pdf_url,
        html_url: doc.html_url,
        json_url: doc.json_url,
        sections: doc.sections?.map((s: any) => ({
          title: s.title,
          content: s.content,
        })),
      };
    } catch (error) {
      console.error("Federal Register API error:", error);
      return null;
    }
  }
}

// US Code API Functions
export class USCodeAPI {
  async searchCode(
    query: string,
    title?: number,
    limit: number = 20,
  ): Promise<USCodeSection[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
        ...(title && { title: title.toString() }),
      });

      // Add timeout and retry logic for US Code API
      const response = await axios.get(
        `${API_ENDPOINTS.US_CODE}/search?${params}`,
        {
          timeout: 30000, // 30 second timeout
          validateStatus: (status) => status < 500, // Don't throw on 4xx
        },
      );

      // Handle API errors gracefully
      if (response.status >= 400) {
        console.error(
          `US Code API error: ${response.status} - ${response.statusText}`,
        );
        return [];
      }

      return (
        response.data.results?.map((section: any) => ({
          title: section.title,
          section: section.section,
          text: section.text,
          url: section.url,
          last_updated: section.last_updated,
          source: section.source,
        })) || []
      );
    } catch (error: any) {
      if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
        console.error(
          "US Code API: Connection timeout. The API may be temporarily unavailable.",
        );
      } else if (error.code === "ECONNREFUSED") {
        console.error(
          "US Code API: Connection refused. The API endpoint may be down.",
        );
      } else {
        console.error("US Code API error:", error.message || error);
      }
      return [];
    }
  }

  async getSection(
    title: number,
    section: string,
  ): Promise<USCodeSection | null> {
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.US_CODE}/title/${title}/section/${section}`,
      );

      const data = response.data;
      return {
        title: data.title,
        section: data.section,
        text: data.text,
        url: data.url,
        last_updated: data.last_updated,
        source: data.source,
      };
    } catch (error) {
      console.error("US Code API error:", error);
      return null;
    }
  }
}

// CourtListener API Functions
export class CourtListenerAPI {
  private apiKey?: string;

  constructor(apiKey?: string) {
    // CourtListener API doesn't require key but has rate limits without one
    this.apiKey = apiKey || process.env.COURT_LISTENER_API_KEY;
  }

  async searchOpinions(
    query: string,
    court?: string,
    limit: number = 20,
  ): Promise<CourtOpinion[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        type: "o", // 'o' for opinions
        page_size: limit.toString(),
        ordering: "-date_filed",
        ...(court && { court: court }),
      });

      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (this.apiKey) {
        headers["Authorization"] = `Token ${this.apiKey}`;
      }

      const response = await axios.get(
        `${API_ENDPOINTS.COURT_LISTENER}/search/`,
        { params, headers },
      );

      return (
        response.data.results?.map((opinion: any) => {
          const absoluteUrl =
            opinion.absoluteUrl ||
            opinion.absolute_url ||
            (opinion.id
              ? `https://www.courtlistener.com/opinion/${opinion.id}/`
              : undefined);
          return {
            id: opinion.id,
            case_name: opinion.caseName || opinion.case_name,
            case_name_full: opinion.caseNameFull || opinion.case_name_full,
            date_filed: opinion.dateFiled || opinion.date_filed,
            date_modified: opinion.dateModified || opinion.date_modified,
            court: opinion.court || opinion.court_name,
            court_id: opinion.courtId || opinion.court_id,
            jurisdiction: opinion.jurisdiction,
            citation: opinion.citation,
            citation_count: opinion.citationCount || opinion.citation_count,
            precedential_status:
              opinion.precedentialStatus || opinion.precedential_status,
            url: absoluteUrl,
            absolute_url: absoluteUrl,
            download_url: opinion.downloadUrl || opinion.download_url,
            plain_text: opinion.plainText || opinion.plain_text,
            html: opinion.html,
            html_lawbox: opinion.htmlLawbox || opinion.html_lawbox,
            html_columbia: opinion.htmlColumbia || opinion.html_columbia,
            html_anon_2020: opinion.htmlAnon2020 || opinion.html_anon_2020,
            judges: opinion.judges,
            docket: opinion.docket,
            docket_number: opinion.docketNumber || opinion.docket_number,
            slug: opinion.slug,
          };
        }) || []
      );
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.error(
          "CourtListener API: API key required. Get one at https://www.courtlistener.com/api/",
        );
      } else {
        console.error("CourtListener API error:", error.message || error);
      }
      return [];
    }
  }

  async getRecentOpinions(
    court?: string,
    limit: number = 20,
  ): Promise<CourtOpinion[]> {
    try {
      const params = new URLSearchParams({
        type: "o", // 'o' for opinions
        page_size: limit.toString(),
        ordering: "-date_filed",
        ...(court && { court: court }),
      });

      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (this.apiKey) {
        headers["Authorization"] = `Token ${this.apiKey}`;
      }

      const response = await axios.get(
        `${API_ENDPOINTS.COURT_LISTENER}/search/`,
        { params, headers },
      );

      return (
        response.data.results?.map((opinion: any) => {
          const absoluteUrl =
            opinion.absoluteUrl ||
            opinion.absolute_url ||
            (opinion.id
              ? `https://www.courtlistener.com/opinion/${opinion.id}/`
              : undefined);
          return {
            id: opinion.id,
            case_name: opinion.caseName || opinion.case_name,
            case_name_full: opinion.caseNameFull || opinion.case_name_full,
            date_filed: opinion.dateFiled || opinion.date_filed,
            date_modified: opinion.dateModified || opinion.date_modified,
            court: opinion.court || opinion.court_name,
            court_id: opinion.courtId || opinion.court_id,
            jurisdiction: opinion.jurisdiction,
            citation: opinion.citation,
            citation_count: opinion.citationCount || opinion.citation_count,
            precedential_status:
              opinion.precedentialStatus || opinion.precedential_status,
            url: absoluteUrl,
            absolute_url: absoluteUrl,
            download_url: opinion.downloadUrl || opinion.download_url,
            plain_text: opinion.plainText || opinion.plain_text,
            html: opinion.html,
            html_lawbox: opinion.htmlLawbox || opinion.html_lawbox,
            html_columbia: opinion.htmlColumbia || opinion.html_columbia,
            html_anon_2020: opinion.htmlAnon2020 || opinion.html_anon_2020,
            judges: opinion.judges,
            docket: opinion.docket,
            docket_number: opinion.docketNumber || opinion.docket_number,
            slug: opinion.slug,
          };
        }) || []
      );
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.error(
          "CourtListener API: API key required. Get one at https://www.courtlistener.com/api/",
        );
      } else {
        console.error("CourtListener API error:", error.message || error);
      }
      return [];
    }
  }

  async getOpinion(opinionId: number): Promise<CourtOpinion | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers["Authorization"] = `Token ${this.apiKey}`;
      }

      const response = await axios.get(
        `${API_ENDPOINTS.COURT_LISTENER}/search/${opinionId}/`,
        { headers },
      );

      const opinion = response.data;
      return {
        id: opinion.id,
        case_name: opinion.caseName,
        case_name_full: opinion.caseNameFull,
        date_filed: opinion.dateFiled,
        date_modified: opinion.dateModified,
        court: opinion.court,
        court_id: opinion.courtId,
        jurisdiction: opinion.jurisdiction,
        citation: opinion.citation,
        citation_count: opinion.citationCount,
        precedential_status: opinion.precedentialStatus,
        url: opinion.absoluteUrl,
        absolute_url: opinion.absoluteUrl,
        download_url: opinion.downloadUrl,
        plain_text: opinion.plainText,
        html: opinion.html,
        html_lawbox: opinion.htmlLawbox,
        html_columbia: opinion.htmlColumbia,
        html_anon_2020: opinion.htmlAnon2020,
        judges: opinion.judges,
        docket: opinion.docket,
        docket_number: opinion.docketNumber,
        slug: opinion.slug,
      };
    } catch (error) {
      console.error("CourtListener API error:", error);
      return null;
    }
  }
}

// Regulations.gov API Functions
export class RegulationsGovAPI {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.REGULATIONS_GOV_API_KEY || "";
  }

  async searchComments(
    query: string,
    limit: number = 20,
  ): Promise<RegulationComment[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        "page[size]": limit.toString(),
        sort: "-postedDate",
        ...(this.apiKey && { api_key: this.apiKey }),
      });

      const response = await axios.get(
        `${API_ENDPOINTS.REGULATIONS_GOV}/comments?${params}`,
      );

      return (
        response.data.data?.map((comment: any) => ({
          id: comment.id,
          comment: comment.attributes.comment,
          posted_date: comment.attributes.postedDate,
          agency_id: comment.attributes.agencyId,
          document_id: comment.attributes.documentId,
          submitter_name: comment.attributes.submitterName,
          organization: comment.attributes.organization,
        })) || []
      );
    } catch (error) {
      console.error("Regulations.gov API error:", error);
      return [];
    }
  }
}

// ------------------------------------------------------------------
// Regulator news clients (OCC, SEC, CFTC, Federal Reserve, Treasury/FinCEN)
// ------------------------------------------------------------------

export type RegulatorSource =
  | "occ"
  | "sec"
  | "cftc"
  | "fed"
  | "treasury"
  | "fincen";

export class OCCAPI {
  // OCC publishes an RSS feed of news releases (and related items).
  private feedUrl = `${API_ENDPOINTS.OCC_RSS}/occ_news.xml`;

  async getRecentNews(limit: number = 20): Promise<RegulatorNewsItem[]> {
    try {
      const items = await fetchFeed(this.feedUrl);
      return items.slice(0, limit).map((i) => toRegulatorItem(i, "occ"));
    } catch (error: any) {
      console.error("OCC RSS error:", error.message || error);
      return [];
    }
  }

  async searchNews(
    query: string,
    limit: number = 20,
  ): Promise<RegulatorNewsItem[]> {
    try {
      const items = await fetchFeed(this.feedUrl);
      return filterAndRank(items, query, limit).map((i) =>
        toRegulatorItem(i, "occ"),
      );
    } catch (error: any) {
      console.error("OCC RSS error:", error.message || error);
      return [];
    }
  }
}

export class SECAPI {
  // SEC press releases RSS.
  private feedUrl = API_ENDPOINTS.SEC_PRESS_NEWS_RSS;

  async getRecentNews(limit: number = 20): Promise<RegulatorNewsItem[]> {
    try {
      const items = await fetchFeed(this.feedUrl);
      return items.slice(0, limit).map((i) => toRegulatorItem(i, "sec"));
    } catch (error: any) {
      console.error("SEC RSS error:", error.message || error);
      return [];
    }
  }

  async searchNews(
    query: string,
    limit: number = 20,
  ): Promise<RegulatorNewsItem[]> {
    try {
      const items = await fetchFeed(this.feedUrl);
      return filterAndRank(items, query, limit).map((i) =>
        toRegulatorItem(i, "sec"),
      );
    } catch (error: any) {
      console.error("SEC RSS error:", error.message || error);
      return [];
    }
  }
}

export class CFTCAPI {
  // CFTC's RSS feeds are served behind Cloudflare and reject Node/axios clients
  // even with browser-like User-Agents (JA3 fingerprint challenge). We scrape
  // the HTML press release listing page instead, which reliably returns a table
  // of (release number -> title) anchors plus embedded <time> date elements.
  private listingUrl = "https://www.cftc.gov/PressRoom/PressReleases";

  async getRecentNews(limit: number = 20): Promise<RegulatorNewsItem[]> {
    return scrapeListing(
      this.listingUrl,
      "/PressRoom/PressReleases/",
      "cftc",
      limit,
    );
  }

  async searchNews(
    query: string,
    limit: number = 20,
  ): Promise<RegulatorNewsItem[]> {
    const all = await scrapeListing(
      this.listingUrl,
      "/PressRoom/PressReleases/",
      "cftc",
      Math.max(limit * 5, 40),
    );
    const feedItems: FeedItem[] = all.map((r) => ({
      title: r.title,
      link: r.link,
      date: r.date,
      summary: r.summary,
    }));
    const ranked = filterAndRank(feedItems, query, limit);
    const byLink = new Map(all.map((r) => [r.link, r] as const));
    return ranked
      .map((i) => byLink.get(i.link))
      .filter((x): x is RegulatorNewsItem => !!x);
  }
}

export class FederalReserveAPI {
  private feedUrl = API_ENDPOINTS.FED_PRESS_ALL_RSS;

  async getRecentNews(limit: number = 20): Promise<RegulatorNewsItem[]> {
    try {
      const items = await fetchFeed(this.feedUrl);
      return items.slice(0, limit).map((i) => toRegulatorItem(i, "fed"));
    } catch (error: any) {
      console.error("Federal Reserve RSS error:", error.message || error);
      return [];
    }
  }

  async searchNews(
    query: string,
    limit: number = 20,
  ): Promise<RegulatorNewsItem[]> {
    try {
      const items = await fetchFeed(this.feedUrl);
      return filterAndRank(items, query, limit).map((i) =>
        toRegulatorItem(i, "fed"),
      );
    } catch (error: any) {
      console.error("Federal Reserve RSS error:", error.message || error);
      return [];
    }
  }
}

// Treasury and FinCEN do not publish reliable RSS/Atom feeds, so we scrape
// their public press-releases listing pages. The extraction is deliberately
// conservative: (URL, anchor-text) pairs from within news release URL paths.
async function fetchHtml(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        // home.treasury.gov and others refuse non-browser UAs; send a realistic one.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
        Accept: "text/html,application/xhtml+xml",
      },
      timeout: 20000,
      responseType: "text",
      transformResponse: (d) => d,
      validateStatus: (s) => s < 500,
    });
    if (response.status >= 400) {
      // Cloudflare-fronted sites (CFTC) reject Node TLS fingerprints; fall back to curl.
      return await fetchViaCurl(url);
    }
    return response.data || "";
  } catch (err: any) {
    // Network-level error; still try curl once.
    try {
      return await fetchViaCurl(url);
    } catch {
      throw err;
    }
  }
}

async function scrapeListing(
  url: string,
  pathPrefix: string,
  source: RegulatorSource,
  limit: number,
): Promise<RegulatorNewsItem[]> {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    const pattern = new RegExp(
      `<a[^>]+href=\"(${pathPrefix.replace(/\//g, "\\/")}[^\"#]+)\"[^>]*>([\\s\\S]*?)<\\/a>`,
      "g",
    );
    const base = new URL(url).origin;
    const items: RegulatorNewsItem[] = [];
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
      const href = m[1];
      const rawTitle = m[2]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!rawTitle || rawTitle.length < 6) continue;
      // Skip hub/section links
      if (
        /^(press-releases|readouts|statements-remarks|testimonies)$/i.test(
          href.split("/").pop() || "",
        )
      ) {
        continue;
      }
      if (seen.has(href)) continue;
      seen.add(href);
      items.push({
        source,
        title: rawTitle,
        link: href.startsWith("http") ? href : `${base}${href}`,
      });
      if (items.length >= limit * 2) break; // small buffer
    }
    return items.slice(0, limit);
  } catch (error: any) {
    console.error(`${source} scrape error:`, error.message || error);
    return [];
  }
}

export class TreasuryAPI {
  private listingUrl = "https://home.treasury.gov/news/press-releases";

  async getRecentNews(limit: number = 20): Promise<RegulatorNewsItem[]> {
    return scrapeListing(
      this.listingUrl,
      "/news/press-releases/",
      "treasury",
      limit,
    );
  }

  async searchNews(
    query: string,
    limit: number = 20,
  ): Promise<RegulatorNewsItem[]> {
    // Pull a larger slice and filter client-side.
    const all = await scrapeListing(
      this.listingUrl,
      "/news/press-releases/",
      "treasury",
      Math.max(limit * 5, 40),
    );
    const feedItems: FeedItem[] = all.map((r) => ({
      title: r.title,
      link: r.link,
      date: r.date,
      summary: r.summary,
    }));
    const ranked = filterAndRank(feedItems, query, limit);
    const byLink = new Map(all.map((r) => [r.link, r] as const));
    return ranked
      .map((i) => byLink.get(i.link))
      .filter((x): x is RegulatorNewsItem => !!x);
  }
}

export class FinCENAPI {
  private listingUrl = "https://www.fincen.gov/news/press-releases";

  async getRecentNews(limit: number = 20): Promise<RegulatorNewsItem[]> {
    return scrapeListing(
      this.listingUrl,
      "/news/news-releases/",
      "fincen",
      limit,
    );
  }

  async searchNews(
    query: string,
    limit: number = 20,
  ): Promise<RegulatorNewsItem[]> {
    const all = await scrapeListing(
      this.listingUrl,
      "/news/news-releases/",
      "fincen",
      Math.max(limit * 5, 40),
    );
    const feedItems: FeedItem[] = all.map((r) => ({
      title: r.title,
      link: r.link,
      date: r.date,
      summary: r.summary,
    }));
    const ranked = filterAndRank(feedItems, query, limit);
    const byLink = new Map(all.map((r) => [r.link, r] as const));
    return ranked
      .map((i) => byLink.get(i.link))
      .filter((x): x is RegulatorNewsItem => !!x);
  }
}

function toRegulatorItem(
  item: FeedItem,
  source: RegulatorSource,
): RegulatorNewsItem {
  return {
    source,
    title: item.title,
    link: item.link,
    date: item.date,
    summary: item.summary,
    category: item.category,
  };
}

// Main US Legal API Class
export class USLegalAPI {
  public congress: CongressAPI;
  public federalRegister: FederalRegisterAPI;
  public usCode: USCodeAPI;
  public regulations: RegulationsGovAPI;
  public courtListener: CourtListenerAPI;
  public govInfo: GovInfoAPI;
  public occ: OCCAPI;
  public sec: SECAPI;
  public cftc: CFTCAPI;
  public fed: FederalReserveAPI;
  public treasury: TreasuryAPI;
  public fincen: FinCENAPI;

  constructor(apiKeys?: {
    congress?: string;
    regulationsGov?: string;
    courtListener?: string;
    govInfo?: string;
  }) {
    this.congress = new CongressAPI(apiKeys?.congress);
    this.federalRegister = new FederalRegisterAPI();
    this.usCode = new USCodeAPI();
    this.regulations = new RegulationsGovAPI(apiKeys?.regulationsGov);
    this.courtListener = new CourtListenerAPI(apiKeys?.courtListener);
    this.govInfo = new GovInfoAPI(apiKeys?.govInfo);
    this.occ = new OCCAPI();
    this.sec = new SECAPI();
    this.cftc = new CFTCAPI();
    this.fed = new FederalReserveAPI();
    this.treasury = new TreasuryAPI();
    this.fincen = new FinCENAPI();
  }

  getRegulator(source: RegulatorSource) {
    switch (source) {
      case "occ":
        return this.occ;
      case "sec":
        return this.sec;
      case "cftc":
        return this.cftc;
      case "fed":
        return this.fed;
      case "treasury":
        return this.treasury;
      case "fincen":
        return this.fincen;
    }
  }

  async getRecentRegulatorNews(
    source: RegulatorSource | "all",
    limit: number = 20,
  ): Promise<RegulatorNewsItem[]> {
    if (source === "all") {
      const sources: RegulatorSource[] = [
        "occ",
        "sec",
        "cftc",
        "fed",
        "treasury",
        "fincen",
      ];
      const per = Math.max(1, Math.ceil(limit / sources.length));
      const results = await Promise.all(
        sources.map((s) => this.getRegulator(s).getRecentNews(per)),
      );
      const flat = results.flat();
      flat.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return flat.slice(0, limit);
    }
    return this.getRegulator(source).getRecentNews(limit);
  }

  async searchRegulatorNews(
    query: string,
    source: RegulatorSource | "all",
    limit: number = 20,
  ): Promise<RegulatorNewsItem[]> {
    if (source === "all") {
      const sources: RegulatorSource[] = [
        "occ",
        "sec",
        "cftc",
        "fed",
        "treasury",
        "fincen",
      ];
      const per = Math.max(1, Math.ceil(limit / sources.length));
      const results = await Promise.all(
        sources.map((s) =>
          this.getRegulator(s)
            .searchNews(query, per)
            .catch(() => [] as RegulatorNewsItem[]),
        ),
      );
      const flat = results.flat();
      flat.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return flat.slice(0, limit);
    }
    return this.getRegulator(source).searchNews(query, limit);
  }

  // Comprehensive search across all sources
  async searchAll(
    query: string,
    limit: number = 20,
  ): Promise<{
    bills: CongressBill[];
    regulations: FederalRegisterDocument[];
    codeSections: USCodeSection[];
    comments: RegulationComment[];
  }> {
    const [bills, regulations, codeSections, comments] = await Promise.all([
      this.congress.searchBills(query, undefined, Math.ceil(limit / 4)),
      this.federalRegister.searchDocuments(query, Math.ceil(limit / 4)),
      this.usCode.searchCode(query, undefined, Math.ceil(limit / 4)),
      this.regulations.searchComments(query, Math.ceil(limit / 4)),
    ]);

    return {
      bills,
      regulations,
      codeSections,
      comments,
    };
  }
}

export default USLegalAPI;
