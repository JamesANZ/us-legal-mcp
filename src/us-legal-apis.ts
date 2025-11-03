// US Legal APIs Integration
// Comprehensive integration with US government legal data sources

import axios from "axios";

// API Base URLs
export const API_ENDPOINTS = {
  CONGRESS: "https://api.congress.gov/v3",
  FEDERAL_REGISTER: "https://www.federalregister.gov/api/v1",
  US_CODE: "https://uscode.house.gov/api",
  REGULATIONS_GOV: "https://api.regulations.gov/v4",
  GPO: "https://api.govinfo.gov",
  COURT_LISTENER: "https://www.courtlistener.com/api/rest/v3",
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
  ): Promise<CongressBill[]> {
    try {
      const params = new URLSearchParams({
        q: query,
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
        subjects: bill.subjects?.map((s: any) => s.name),
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

// Federal Register API Functions
export class FederalRegisterAPI {
  async searchDocuments(
    query: string,
    limit: number = 20,
  ): Promise<FederalRegisterDocument[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        per_page: limit.toString(),
        order: "relevance",
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

      const response = await axios.get(
        `${API_ENDPOINTS.US_CODE}/search?${params}`,
      );

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
    } catch (error) {
      console.error("US Code API error:", error);
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

// Main US Legal API Class
export class USLegalAPI {
  public congress: CongressAPI;
  public federalRegister: FederalRegisterAPI;
  public usCode: USCodeAPI;
  public regulations: RegulationsGovAPI;
  public courtListener: CourtListenerAPI;

  constructor(apiKeys?: {
    congress?: string;
    regulationsGov?: string;
    courtListener?: string;
  }) {
    this.congress = new CongressAPI(apiKeys?.congress);
    this.federalRegister = new FederalRegisterAPI();
    this.usCode = new USCodeAPI();
    this.regulations = new RegulationsGovAPI(apiKeys?.regulationsGov);
    this.courtListener = new CourtListenerAPI(apiKeys?.courtListener);
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
