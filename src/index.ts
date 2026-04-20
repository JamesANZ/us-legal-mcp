#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import USLegalAPI, { parseBillId, RegulatorSource } from "./us-legal-apis.js";
import {
  CURATED_ACTS,
  formatCuratedAct,
  GENIUS_ACT,
  CLARITY_ACT,
  TRACKED_DIGITAL_ASSET_BILLS,
  queryMatchesDigitalAssets,
  matchingCuratedActs,
  type CuratedAct,
} from "./data/crypto-legislation.js";

// Initialize US Legal API
const apiKeys = {
  congress: process.env.CONGRESS_API_KEY,
  regulationsGov: process.env.REGULATIONS_GOV_API_KEY,
  courtListener: process.env.COURT_LISTENER_API_KEY,
  govInfo: process.env.GOVINFO_API_KEY,
};

// Log API key status (to stderr for debugging)
console.error("🔑 API Key Status:");
console.error(`   Congress.gov: ${apiKeys.congress ? "✅ Set" : "❌ Missing"}`);
console.error(
  `   CourtListener: ${apiKeys.courtListener ? "✅ Set" : "❌ Missing"}`,
);
console.error(
  `   Regulations.gov: ${apiKeys.regulationsGov ? "✅ Set" : "❌ Missing"}`,
);
console.error(
  `   GovInfo: ${apiKeys.govInfo ? "✅ Set" : "⚠️  Using DEMO_KEY (rate-limited)"}`,
);

const usLegalAPI = new USLegalAPI(apiKeys);

// Resolve a bill argument that can be either { billId: "s1582-119" } or
// { congress, type, number }. Returns null + a human-readable error message
// when input is missing/malformed.
function resolveBillRef(
  args: any,
):
  | { ok: true; congress: number; type: string; number: number }
  | { ok: false; error: string } {
  if (typeof args?.billId === "string" && args.billId.trim()) {
    const parsed = parseBillId(args.billId);
    if (!parsed) {
      return {
        ok: false,
        error: `Invalid billId '${args.billId}'. Expected format like 's1582-119' or 'hr3633-119'.`,
      };
    }
    return { ok: true, ...parsed };
  }
  const congress = Number(args?.congress);
  const type = typeof args?.type === "string" ? args.type.toLowerCase() : "";
  const number = Number(args?.number);
  if (!congress || !type || !number) {
    return {
      ok: false,
      error:
        "Provide either billId (e.g. 's1582-119') OR all of congress, type, number.",
    };
  }
  return { ok: true, congress, type, number };
}

const VALID_REGULATOR_SOURCES: Array<RegulatorSource | "all"> = [
  "occ",
  "sec",
  "cftc",
  "fed",
  "treasury",
  "fincen",
  "all",
];

function normalizeSource(
  s: unknown,
  def: RegulatorSource | "all" = "all",
): RegulatorSource | "all" {
  if (typeof s === "string") {
    const lower = s.toLowerCase();
    if ((VALID_REGULATOR_SOURCES as string[]).includes(lower)) {
      return lower as RegulatorSource | "all";
    }
  }
  return def;
}

function formatRegulatorItems(
  items: Array<{
    source: string;
    title: string;
    link: string;
    date?: string;
    summary?: string;
    category?: string;
  }>,
): string {
  if (items.length === 0) return "_No results._";
  return items
    .map((it, i) => {
      const parts: string[] = [];
      parts.push(`${i + 1}. **[${it.source.toUpperCase()}] ${it.title}**`);
      const meta: string[] = [];
      if (it.date) meta.push(it.date.substring(0, 10));
      if (it.category) meta.push(it.category);
      if (meta.length) parts.push(`   ${meta.join(" | ")}`);
      if (it.summary) {
        const s =
          it.summary.length > 400
            ? it.summary.substring(0, 400) + "..."
            : it.summary;
        parts.push(`   ${s}`);
      }
      parts.push(`   ${it.link}`);
      return parts.join("\n");
    })
    .join("\n\n");
}

// Create MCP server
const server = new Server(
  {
    name: "us-legal-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_congress_bills": {
        const { query, congress, limit } = args as {
          query: string;
          congress?: number;
          limit?: number;
        };

        try {
          const bills = await usLegalAPI.congress.searchBills(
            query,
            congress,
            limit,
            { strict: true },
          );

          if (bills.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `**Congress Bills Search Results for "${query}"**\n\nNo bills found matching your search query.\n\n**Troubleshooting:**\n- Try broader or different search terms (e.g., "border" instead of "immigration")\n- Verify Congress.gov API key is set (CONGRESS_API_KEY)\n- Try a different Congress session (e.g., 118 instead of 119)\n- The API may have returned results but they were filtered for low relevance\n- Note: Some topics may have limited federal legislation\n\n**Tip:** Use \`get_recent_bills\` to see recent legislation regardless of topic.`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `**Congress Bills Search Results for "${query}"**\n\nFound ${bills.length} result(s)\n\n` +
                  bills
                    .map(
                      (bill, index) =>
                        `${index + 1}. **${bill.title}**\n   ${bill.type} ${bill.number} - ${bill.latestAction?.text || "No status"}\n   ${bill.url}\n`,
                    )
                    .join("\n"),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `**Error searching Congress bills:** ${error.message || "Unknown error"}\n\n**Possible causes:**\n- Congress.gov API may be unavailable\n- API key may be missing or invalid\n- Rate limiting may be active`,
              },
            ],
          };
        }
      }

      case "search_federal_register": {
        const { query, limit } = args as { query: string; limit?: number };
        const documents = await usLegalAPI.federalRegister.searchDocuments(
          query,
          limit,
        );

        return {
          content: [
            {
              type: "text",
              text:
                `**Federal Register Search Results for "${query}"**\n\nFound ${documents.length} result(s)\n\n` +
                documents
                  .map(
                    (doc, index) =>
                      `${index + 1}. **${doc.title}**\n   ${doc.document_number} - ${doc.agency_names?.[0] || "Unknown agency"}\n   ${doc.html_url}\n`,
                  )
                  .join("\n"),
            },
          ],
        };
      }

      case "search_all_legal": {
        const { query, limit } = args as { query: string; limit?: number };

        // Use strict mode on bill search: the Congress.gov /bill endpoint
        // silently ignores the `q` parameter, so without client-side
        // filtering we end up returning whatever happens to be at the top
        // of the listing (e.g. "Ten Commandments" or "Reserved for the
        // Speaker"). Strict mode drops unmatched bills instead of padding.
        const [bills, regulations, opinions] = await Promise.all([
          usLegalAPI.congress.searchBills(
            query,
            undefined,
            Math.ceil((limit || 10) / 3),
            { strict: true },
          ),
          usLegalAPI.federalRegister.searchDocuments(
            query,
            Math.ceil((limit || 10) / 3),
          ),
          usLegalAPI.courtListener.searchOpinions(
            query,
            undefined,
            Math.ceil((limit || 10) / 3),
          ),
        ]);

        return {
          content: [
            {
              type: "text",
              text:
                `**Comprehensive US Legal Search Results for "${query}"**\n\n` +
                `- Bills: ${bills.length}\n` +
                `- Regulations: ${regulations.length}\n` +
                `- Court Opinions: ${opinions.length}\n\n` +
                `**Top Results:**\n\n` +
                (bills.length > 0
                  ? `**Congress Bills (${bills.length}):**\n` +
                    bills
                      .slice(0, 3)
                      .map(
                        (bill, index) =>
                          `${index + 1}. **${bill.title}** (Bill)\n   ${bill.type} ${bill.number}\n   ${bill.url}\n`,
                      )
                      .join("\n") +
                    "\n\n"
                  : "") +
                (regulations.length > 0
                  ? `**Federal Register (${regulations.length}):**\n` +
                    regulations
                      .slice(0, 3)
                      .map(
                        (doc, index) =>
                          `${index + 1}. **${doc.title}** (Regulation)\n   ${doc.document_number}\n   ${doc.html_url}\n`,
                      )
                      .join("\n") +
                    "\n\n"
                  : "") +
                (opinions.length > 0
                  ? `**Court Opinions (${opinions.length}):**\n` +
                    opinions
                      .slice(0, 3)
                      .map(
                        (opinion, index) =>
                          `${index + 1}. **${opinion.case_name}** (Court Case)\n   ${opinion.court} - ${opinion.date_filed}\n   ${opinion.url}\n`,
                      )
                      .join("\n")
                  : "") +
                (bills.length === 0 &&
                regulations.length === 0 &&
                opinions.length === 0
                  ? `No results found across available sources.`
                  : ""),
            },
          ],
        };
      }

      case "get_recent_bills": {
        const { congress, limit } = args as {
          congress?: number;
          limit?: number;
        };

        try {
          const bills = await usLegalAPI.congress.getRecentBills(
            congress,
            limit,
          );

          if (bills.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `**Recent Bills in Congress ${congress || 118}**\n\nNo recent bills found.\n\n**Troubleshooting:**\n- Verify Congress.gov API key is set (CONGRESS_API_KEY)\n- Try a different Congress number (e.g., 119 for current)\n- API may be temporarily unavailable`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `**Recent Bills in Congress ${congress || 118}**\n\nFound ${bills.length} result(s)\n\n` +
                  bills
                    .map(
                      (bill, index) =>
                        `${index + 1}. **${bill.title}**\n   ${bill.type} ${bill.number} - ${bill.latestAction?.text || "No status"}\n   ${bill.url}\n`,
                    )
                    .join("\n"),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `**Error retrieving recent bills:** ${error.message || "Unknown error"}\n\n**Possible causes:**\n- Congress.gov API may be unavailable\n- API key may be missing or invalid`,
              },
            ],
          };
        }
      }

      case "get_recent_regulations": {
        const { limit } = args as { limit?: number };
        const documents =
          await usLegalAPI.federalRegister.getRecentDocuments(limit);

        return {
          content: [
            {
              type: "text",
              text:
                `**Recent Federal Register Documents**\n\nFound ${documents.length} result(s)\n\n` +
                documents
                  .map(
                    (doc, index) =>
                      `${index + 1}. **${doc.title}**\n   ${doc.document_number} - ${doc.agency_names?.[0] || "Unknown agency"}\n   ${doc.html_url}\n`,
                  )
                  .join("\n"),
            },
          ],
        };
      }

      case "search_court_opinions": {
        const { query, court, limit } = args as {
          query: string;
          court?: string;
          limit?: number;
        };

        try {
          const opinions = await usLegalAPI.courtListener.searchOpinions(
            query,
            court,
            limit,
          );

          if (opinions.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `**Court Opinions Search Results for "${query}"**\n\nNo court opinions found matching your search.\n\n**Troubleshooting:**\n- Try different search terms or broader keywords\n- Verify CourtListener API key is set (COURT_LISTENER_API_KEY)\n- Try specific court filters (e.g., "scotus" for Supreme Court)\n- Note: Some topics may have limited federal court cases`,
                },
              ],
            };
          }

          // Fetch full text for top 3-5 results that don't have text
          const topOpinionsToFetch = opinions
            .slice(0, Math.min(5, opinions.length))
            .filter((op) => !op.plain_text && !op.html);

          // Fetch full opinions in parallel
          const fetchedOpinions = await Promise.all(
            topOpinionsToFetch.map((op) =>
              usLegalAPI.courtListener.getOpinion(op.id).catch(() => null),
            ),
          );

          // Create a map of fetched opinions
          const fetchedMap = new Map(
            fetchedOpinions
              .filter((op) => op !== null)
              .map((op) => [op!.id, op!]),
          );

          // Merge fetched full text into original opinions
          const enhancedOpinions = opinions.map((op) => {
            const fetched = fetchedMap.get(op.id);
            if (fetched && (fetched.plain_text || fetched.html)) {
              return {
                ...op,
                plain_text: op.plain_text || fetched.plain_text,
                html: op.html || fetched.html,
              };
            }
            return op;
          });

          // Format opinions with excerpts from the text
          const formattedOpinions = enhancedOpinions.map((opinion, index) => {
            let excerpt = "";

            // Try to get text excerpt (first 1500 characters for better context)
            if (opinion.plain_text) {
              excerpt = opinion.plain_text.substring(0, 1500).trim();
              if (opinion.plain_text.length > 1500) {
                excerpt += "...";
              }
            } else if (opinion.html) {
              // Strip HTML tags for a plain text excerpt
              excerpt = opinion.html
                .replace(/<[^>]*>/g, "")
                .substring(0, 1500)
                .trim();
              if (opinion.html.replace(/<[^>]*>/g, "").length > 1500) {
                excerpt += "...";
              }
            }

            let result = `${index + 1}. **${opinion.case_name}${opinion.case_name_full ? ` (${opinion.case_name_full})` : ""}**\n`;
            result += `   Court: ${opinion.court} | Date: ${opinion.date_filed}\n`;
            if (opinion.citation) {
              result += `   Citation: ${opinion.citation}\n`;
            }
            if (opinion.judges && opinion.judges.length > 0) {
              result += `   Judges: ${opinion.judges.join(", ")}\n`;
            }
            result += `   Status: ${opinion.precedential_status}\n`;
            if (excerpt) {
              result += `   \n   **Excerpt from Opinion:**\n   ${excerpt}\n`;
            } else {
              result += `   \n   *Full text not available in search results. See link below for complete opinion.*\n`;
            }
            result += `   Full text: ${opinion.url}\n`;

            return result;
          });

          return {
            content: [
              {
                type: "text",
                text: `**Court Opinions Search Results for "${query}"**\n\nFound ${opinions.length} result(s)\n\n${formattedOpinions.join("\n\n")}`,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `**Error searching court opinions:** ${error.message || "Unknown error"}\n\n**Possible causes:**\n- CourtListener API may be unavailable\n- API key may be missing or invalid\n- Rate limiting may be active`,
              },
            ],
          };
        }
      }

      case "get_recent_court_opinions": {
        const { court, limit } = args as {
          court?: string;
          limit?: number;
        };

        try {
          const opinions = await usLegalAPI.courtListener.getRecentOpinions(
            court,
            limit,
          );

          if (opinions.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `**Recent Court Opinions**\n\nNo recent opinions found.\n\n**Troubleshooting:**\n- Verify CourtListener API key is set (COURT_LISTENER_API_KEY)\n- Try without court filter or use different court code\n- API may be temporarily unavailable`,
                },
              ],
            };
          }

          // Fetch full text for top results that don't have text
          const topOpinionsToFetch = opinions
            .slice(0, Math.min(5, opinions.length))
            .filter((op) => !op.plain_text && !op.html);

          const fetchedOpinions = await Promise.all(
            topOpinionsToFetch.map((op) =>
              usLegalAPI.courtListener.getOpinion(op.id).catch(() => null),
            ),
          );

          const fetchedMap = new Map(
            fetchedOpinions
              .filter((op) => op !== null)
              .map((op) => [op!.id, op!]),
          );

          const enhancedOpinions = opinions.map((op) => {
            const fetched = fetchedMap.get(op.id);
            if (fetched && (fetched.plain_text || fetched.html)) {
              return {
                ...op,
                plain_text: op.plain_text || fetched.plain_text,
                html: op.html || fetched.html,
              };
            }
            return op;
          });

          // Format opinions with excerpts
          const formattedOpinions = enhancedOpinions.map((opinion, index) => {
            let excerpt = "";

            if (opinion.plain_text) {
              excerpt = opinion.plain_text.substring(0, 1500).trim();
              if (opinion.plain_text.length > 1500) {
                excerpt += "...";
              }
            } else if (opinion.html) {
              excerpt = opinion.html
                .replace(/<[^>]*>/g, "")
                .substring(0, 1500)
                .trim();
              if (opinion.html.replace(/<[^>]*>/g, "").length > 1500) {
                excerpt += "...";
              }
            }

            let result = `${index + 1}. **${opinion.case_name}${opinion.case_name_full ? ` (${opinion.case_name_full})` : ""}**\n`;
            result += `   Court: ${opinion.court} | Date: ${opinion.date_filed}\n`;
            if (opinion.citation) {
              result += `   Citation: ${opinion.citation}\n`;
            }
            if (opinion.judges && opinion.judges.length > 0) {
              result += `   Judges: ${opinion.judges.join(", ")}\n`;
            }
            result += `   Status: ${opinion.precedential_status}\n`;
            if (excerpt) {
              result += `   \n   **Excerpt from Opinion:**\n   ${excerpt}\n`;
            } else {
              result += `   \n   *Full text not available. See link below for complete opinion.*\n`;
            }
            result += `   Full text: ${opinion.url}\n`;

            return result;
          });

          return {
            content: [
              {
                type: "text",
                text: `**Recent Court Opinions**\n\nFound ${opinions.length} result(s)\n\n${formattedOpinions.join("\n\n")}`,
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `**Error retrieving recent court opinions:** ${error.message || "Unknown error"}\n\n**Possible causes:**\n- CourtListener API may be unavailable\n- API key may be missing or invalid`,
              },
            ],
          };
        }
      }

      case "get_congress_committees": {
        const { congress, chamber } = args as {
          congress?: number;
          chamber?: "House" | "Senate";
        };
        const committees = await usLegalAPI.congress.getCommittees(
          congress,
          chamber,
        );

        return {
          content: [
            {
              type: "text",
              text:
                `**Congress Committees**\n\nFound ${committees.length} result(s)\n\n` +
                committees
                  .map(
                    (committee, index) =>
                      `${index + 1}. **${committee.name}**\n   ${committee.chamber || "N/A"} - ${committee.committeeType || "N/A"}\n   ${committee.url}\n`,
                  )
                  .join("\n"),
            },
          ],
        };
      }

      case "get_genius_act_info": {
        return {
          content: [{ type: "text", text: formatCuratedAct(GENIUS_ACT) }],
        };
      }

      case "get_clarity_act_info": {
        return {
          content: [{ type: "text", text: formatCuratedAct(CLARITY_ACT) }],
        };
      }

      case "get_curated_act": {
        const slug = String((args as any)?.slug || "").toLowerCase();
        const act = CURATED_ACTS[slug];
        if (!act) {
          return {
            content: [
              {
                type: "text",
                text: `Unknown curated act '${slug}'. Available: ${Object.keys(CURATED_ACTS).join(", ")}`,
              },
            ],
          };
        }
        return { content: [{ type: "text", text: formatCuratedAct(act) }] };
      }

      case "get_bill_details": {
        const ref = resolveBillRef(args);
        if (!ref.ok) {
          return { content: [{ type: "text", text: ref.error }] };
        }
        const bill = await usLegalAPI.congress.getBill(
          ref.congress,
          ref.type,
          ref.number,
        );
        if (!bill) {
          return {
            content: [
              {
                type: "text",
                text: `No bill found for ${ref.type.toUpperCase()}.${ref.number} (${ref.congress}th Congress).`,
              },
            ],
          };
        }
        const lines: string[] = [];
        lines.push(
          `# ${bill.type || ref.type.toUpperCase()} ${bill.number || ref.number} - ${bill.congress || ref.congress}th Congress`,
        );
        if (bill.title) lines.push(`**Title:** ${bill.title}`);
        if (bill.shortTitle) lines.push(`**Short Title:** ${bill.shortTitle}`);
        if (bill.introducedDate)
          lines.push(`**Introduced:** ${bill.introducedDate}`);
        if (bill.latestAction) {
          lines.push(
            `**Latest Action (${bill.latestAction.actionDate || "?"}):** ${bill.latestAction.text || ""}`,
          );
        }
        if (bill.policyArea?.name)
          lines.push(`**Policy Area:** ${bill.policyArea.name}`);
        if (bill.sponsors?.length) {
          lines.push(
            `**Sponsor:** ${bill.sponsors
              .map(
                (s: any) =>
                  `${s.fullName || `${s.firstName || ""} ${s.lastName || ""}`} (${s.party || "?"}-${s.state || "?"})`,
              )
              .join("; ")}`,
          );
        }
        if (bill.cosponsors?.count !== undefined) {
          lines.push(`**Cosponsors:** ${bill.cosponsors.count}`);
        }
        if (bill.committees?.count !== undefined) {
          lines.push(`**Committees:** ${bill.committees.count}`);
        }
        if (bill.summaries?.url) {
          lines.push(`**Summaries API:** ${bill.summaries.url}`);
        }
        if (bill.textVersions?.url) {
          lines.push(`**Text Versions API:** ${bill.textVersions.url}`);
        }
        if (bill.url) lines.push(`**API URL:** ${bill.url}`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      }

      case "get_bill_actions": {
        const ref = resolveBillRef(args);
        if (!ref.ok) {
          return { content: [{ type: "text", text: ref.error }] };
        }
        const limit = Number((args as any)?.limit) || 50;
        const actions = await usLegalAPI.congress.getBillActions(
          ref.congress,
          ref.type,
          ref.number,
          limit,
        );
        if (actions.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No actions found for ${ref.type.toUpperCase()}.${ref.number} (${ref.congress}th).`,
              },
            ],
          };
        }
        const lines = actions
          .map((a, i) => {
            const head = `${i + 1}. **${a.actionDate || "?"}** - ${a.text || ""}`;
            const meta: string[] = [];
            if (a.type) meta.push(a.type);
            if (a.actionCode) meta.push(a.actionCode);
            if (a.sourceSystem?.name) meta.push(a.sourceSystem.name);
            return meta.length ? `${head}\n   (${meta.join(" | ")})` : head;
          })
          .join("\n");
        return {
          content: [
            {
              type: "text",
              text: `# Actions for ${ref.type.toUpperCase()}.${ref.number} (${ref.congress}th Congress) - ${actions.length} action(s)\n\n${lines}`,
            },
          ],
        };
      }

      case "get_bill_text": {
        const ref = resolveBillRef(args);
        if (!ref.ok) {
          return { content: [{ type: "text", text: ref.error }] };
        }
        const versions = await usLegalAPI.congress.getBillTextVersions(
          ref.congress,
          ref.type,
          ref.number,
        );
        if (versions.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No text versions found for ${ref.type.toUpperCase()}.${ref.number} (${ref.congress}th).`,
              },
            ],
          };
        }
        const lines = versions
          .map((v, i) => {
            const formats = (v.formats || [])
              .map((f) => `     - ${f.type}: ${f.url}`)
              .join("\n");
            return `${i + 1}. **${v.type}**${v.date ? ` (${v.date})` : ""}\n${formats}`;
          })
          .join("\n\n");
        return {
          content: [
            {
              type: "text",
              text: `# Text Versions for ${ref.type.toUpperCase()}.${ref.number} (${ref.congress}th Congress)\n\n${lines}`,
            },
          ],
        };
      }

      case "get_public_law_text": {
        const congress = Number((args as any)?.congress);
        const lawNumber = Number((args as any)?.lawNumber);
        const maxChars = Number((args as any)?.maxChars) || 20000;
        if (!congress || !lawNumber) {
          return {
            content: [
              {
                type: "text",
                text: "Required arguments: congress (e.g. 119) and lawNumber (e.g. 27 for Pub. L. 119-27).",
              },
            ],
          };
        }
        const summary = await usLegalAPI.govInfo.getPublicLaw(
          congress,
          lawNumber,
        );
        if (!summary) {
          return {
            content: [
              {
                type: "text",
                text: `Public Law ${congress}-${lawNumber} not found on GovInfo. Check the congress and lawNumber values. If rate-limited, set GOVINFO_API_KEY.`,
              },
            ],
          };
        }
        const includeText =
          (args as any)?.includeText === undefined
            ? true
            : Boolean((args as any)?.includeText);
        const text = includeText
          ? await usLegalAPI.govInfo.getPackageText(summary.packageId, maxChars)
          : null;
        const lines: string[] = [];
        lines.push(`# Public Law ${congress}-${lawNumber}`);
        if (summary.title) lines.push(`**Title:** ${summary.title}`);
        if (summary.dateIssued)
          lines.push(`**Date Issued:** ${summary.dateIssued}`);
        if (summary.pages !== undefined)
          lines.push(`**Pages:** ${summary.pages}`);
        lines.push(`**Package ID:** ${summary.packageId}`);
        const links: string[] = [];
        if (summary.pdfUrl) links.push(`[PDF](${summary.pdfUrl})`);
        if (summary.htmlUrl) links.push(`[HTML/Text](${summary.htmlUrl})`);
        if (summary.xmlUrl) links.push(`[XML](${summary.xmlUrl})`);
        if (links.length) lines.push(`**Downloads:** ${links.join(" | ")}`);
        if (summary.abstract) {
          lines.push(`\n**Abstract:** ${summary.abstract}`);
        }
        if (text) {
          lines.push(`\n## Text (truncated to ${maxChars} chars)\n`);
          lines.push(text);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      }

      case "get_recent_regulator_news": {
        const source = normalizeSource((args as any)?.source, "all");
        const limit = Number((args as any)?.limit) || 15;
        const items = await usLegalAPI.getRecentRegulatorNews(source, limit);
        return {
          content: [
            {
              type: "text",
              text: `# Recent ${source === "all" ? "Regulator" : source.toUpperCase()} News (${items.length})\n\n${formatRegulatorItems(items)}`,
            },
          ],
        };
      }

      case "search_regulator_news": {
        const query = String((args as any)?.query || "").trim();
        if (!query) {
          return {
            content: [{ type: "text", text: "Required argument: query" }],
          };
        }
        const source = normalizeSource((args as any)?.source, "all");
        const limit = Number((args as any)?.limit) || 15;
        const items = await usLegalAPI.searchRegulatorNews(
          query,
          source,
          limit,
        );
        return {
          content: [
            {
              type: "text",
              text: `# Regulator News for "${query}" (${source}) - ${items.length} result(s)\n\n${formatRegulatorItems(items)}`,
            },
          ],
        };
      }

      case "search_digital_asset_regulation": {
        const query = String((args as any)?.query || "").trim();
        if (!query) {
          return {
            content: [{ type: "text", text: "Required argument: query" }],
          };
        }
        const limit = Number((args as any)?.limit) || 15;
        const billLimit = Math.max(3, Math.ceil(limit / 2));
        const fedRegLimit = Math.max(3, Math.ceil(limit / 3));
        const newsLimit = limit;

        const isDigitalAssetQuery = queryMatchesDigitalAssets(query);
        const curatedMatches = matchingCuratedActs(query);
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

        // 1. Fetch details for every tracked digital-asset bill in parallel.
        //    These are always relevant when the user is on-topic, but we
        //    still score them so we can sort best-match first.
        const trackedBillResults = await Promise.all(
          TRACKED_DIGITAL_ASSET_BILLS.map((b) =>
            usLegalAPI.congress
              .getBillDetails(b.congress, b.type, b.number)
              .then((detail) => (detail ? { bill: detail, tracked: b } : null))
              .catch(() => null),
          ),
        );

        const scoreBillAgainstQuery = (bill: any, tags: string[] = []) => {
          let s = 0;
          const t = (bill.title || "").toLowerCase();
          const short = (bill.shortTitle || "").toLowerCase();
          const summary = (bill.summary || "").toLowerCase();
          const subjectsHay = (bill.subjects || [])
            .map((x: any) => (typeof x === "string" ? x : x?.name || ""))
            .join(" ")
            .toLowerCase();
          for (const term of queryTerms) {
            if (t.includes(term)) s += 8;
            if (short.includes(term)) s += 6;
            if (summary.includes(term)) s += 3;
            if (subjectsHay.includes(term)) s += 4;
            if (tags.some((tag) => tag.includes(term))) s += 10;
          }
          if (t.includes(queryLower)) s += 15;
          if (short.includes(queryLower)) s += 12;
          return s;
        };

        type ScoredBill = {
          bill: any;
          score: number;
          source: "tracked" | "search";
          note?: string;
        };
        const scoredTracked: ScoredBill[] = [];
        for (const r of trackedBillResults) {
          if (!r) continue;
          const score = scoreBillAgainstQuery(r.bill, r.tracked.tags);
          // If the query is on-topic, always include the tracked bill even
          // with a low direct text score (user asked about the space).
          if (score > 0 || isDigitalAssetQuery) {
            scoredTracked.push({
              bill: r.bill,
              score: score || 1,
              source: "tracked",
              note: r.tracked.note,
            });
          }
        }

        // 2. Run a strict search of the current Congress. Only bills that
        //    actually match the query terms survive the minScore filter.
        const searchedBills = await usLegalAPI.congress
          .searchBills(query, undefined, billLimit, { strict: true })
          .catch(() => []);

        // 3. Merge + dedupe tracked and searched bills by (congress/type/number).
        const billKey = (b: any) =>
          `${b.congress}/${String(b.type || "").toLowerCase()}/${b.number}`;
        const byKey = new Map<string, ScoredBill>();
        for (const sb of scoredTracked) {
          byKey.set(billKey(sb.bill), sb);
        }
        for (const b of searchedBills) {
          const key = billKey(b);
          if (byKey.has(key)) continue; // prefer tracked entry (has note)
          byKey.set(key, {
            bill: b,
            score: scoreBillAgainstQuery(b),
            source: "search",
          });
        }
        const mergedBills = Array.from(byKey.values())
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const da = a.bill.latestAction?.actionDate || "";
            const db = b.bill.latestAction?.actionDate || "";
            return db.localeCompare(da);
          })
          .slice(0, billLimit);

        // 4. Federal Register: the FR relevance-sort returns a lot of
        //    tangentially-matching documents. Filter strictly:
        //    - For digital-asset queries we require the title or abstract
        //      to contain a canonical digital-asset keyword ("stablecoin",
        //      "digital asset", etc.) OR the full user phrase. Individual
        //      query words like "payment" or "exchange" are too noisy.
        //    - For other queries we require the full phrase, or any single
        //      substantive (length >= 5) query term.
        const allFedReg = await usLegalAPI.federalRegister
          .searchDocuments(query, fedRegLimit * 3)
          .catch(() => []);
        const digitalAssetCanonical = [
          "stablecoin",
          "digital asset",
          "digital commodity",
          "digital commodities",
          "cryptocurrency",
          "crypto asset",
          "crypto-asset",
          "blockchain",
          "central bank digital currency",
          "cbdc",
          "distributed ledger",
          "virtual currency",
          "tokenization",
        ];
        const substantiveTerms = queryTerms.filter((t) => t.length >= 5);
        const fedRegKeywords = isDigitalAssetQuery
          ? [queryLower, ...digitalAssetCanonical]
          : [queryLower, ...substantiveTerms];
        const relevantFedReg = allFedReg.filter((d) => {
          const hay = `${d.title || ""} ${d.abstract || ""}`.toLowerCase();
          return fedRegKeywords.some((k) => hay.includes(k));
        });
        const fedRegResults = relevantFedReg.slice(0, fedRegLimit);

        // 5. Regulator news already uses its own scoring in searchRegulatorNews.
        const regulatorItems = await usLegalAPI
          .searchRegulatorNews(query, "all", newsLimit)
          .catch(() => []);

        const sections: string[] = [];
        sections.push(
          `# Digital-Asset Regulation Search: "${query}"\n\n` +
            `- Curated acts matched: ${curatedMatches.length}\n` +
            `- Bills: ${mergedBills.length}\n` +
            `- Federal Register: ${fedRegResults.length}\n` +
            `- Regulator news: ${regulatorItems.length}` +
            (isDigitalAssetQuery
              ? ""
              : '\n\n_Query did not match common digital-asset keywords; consider adding terms like "stablecoin", "digital asset", "market structure", "CBDC", or "crypto" for more targeted results._'),
        );

        if (curatedMatches.length) {
          sections.push(
            `## Curated Acts\n\n` +
              curatedMatches
                .map(
                  (a: CuratedAct) =>
                    `- **${a.shortTitle}** (${a.billId.toUpperCase()}) - ${a.status}\n  Use \`get_curated_act\` with slug \`${a.slug}\` for the full record.`,
                )
                .join("\n"),
          );
        }

        if (mergedBills.length) {
          sections.push(
            `## Congress Bills\n\n` +
              mergedBills
                .map((sb, i) => {
                  const b = sb.bill;
                  const label = sb.source === "tracked" ? " _(tracked)_" : "";
                  const note = sb.note ? ` - ${sb.note}` : "";
                  const action = b.latestAction
                    ? `(${b.latestAction.actionDate || "n/a"}) ${b.latestAction.text}`
                    : "No latest action";
                  return `${i + 1}. **${b.title}**${label}${note}\n   ${String(b.type || "").toUpperCase()} ${b.number} (${b.congress}th Congress) - ${action}\n   ${b.url || `https://www.congress.gov/bill/${b.congress}th-congress/${b.type}/${b.number}`}`;
                })
                .join("\n\n"),
          );
        }

        if (fedRegResults.length) {
          sections.push(
            `## Federal Register\n\n` +
              fedRegResults
                .map(
                  (d, i) =>
                    `${i + 1}. **${d.title}**\n   ${d.document_number} - ${(d.agency_names || [])[0] || "Unknown agency"}\n   ${d.html_url}`,
                )
                .join("\n\n"),
          );
        }

        if (regulatorItems.length) {
          sections.push(
            `## Regulator News\n\n${formatRegulatorItems(regulatorItems)}`,
          );
        }

        if (
          curatedMatches.length === 0 &&
          mergedBills.length === 0 &&
          fedRegResults.length === 0 &&
          regulatorItems.length === 0
        ) {
          sections.push("\n_No results from any source._");
        }
        return { content: [{ type: "text", text: sections.join("\n\n") }] };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool ${name}: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
    };
  }
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_congress_bills",
        description: "Search for bills and resolutions in Congress.gov",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Search query for bills (e.g., 'immigration', 'healthcare', 'infrastructure')",
            },
            congress: {
              type: "number",
              description: "Congress number (e.g., 118 for current Congress)",
              minimum: 100,
              maximum: 120,
            },
            limit: {
              type: "number",
              description: "Number of results to return (max 50)",
              minimum: 1,
              maximum: 50,
              default: 20,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_federal_register",
        description:
          "Search for documents in the Federal Register (regulations, executive orders, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Search query for regulations (e.g., 'environmental', 'healthcare', 'immigration')",
            },
            limit: {
              type: "number",
              description: "Number of results to return (max 50)",
              minimum: 1,
              maximum: 50,
              default: 20,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_all_legal",
        description:
          "Comprehensive search across all US legal sources (Congress, Federal Register, Court Opinions)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query across all legal sources",
            },
            limit: {
              type: "number",
              description: "Number of results to return per source (max 50)",
              minimum: 1,
              maximum: 50,
              default: 10,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_recent_bills",
        description: "Get the most recently introduced bills in Congress",
        inputSchema: {
          type: "object",
          properties: {
            congress: {
              type: "number",
              description: "Congress number (e.g., 118 for current Congress)",
              minimum: 100,
              maximum: 120,
            },
            limit: {
              type: "number",
              description: "Number of results to return (max 50)",
              minimum: 1,
              maximum: 50,
              default: 20,
            },
          },
        },
      },
      {
        name: "get_recent_regulations",
        description:
          "Get the most recently published Federal Register documents",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of results to return (max 50)",
              minimum: 1,
              maximum: 50,
              default: 20,
            },
          },
        },
      },
      {
        name: "search_court_opinions",
        description:
          "Search for court opinions and decisions from CourtListener (federal and state courts)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Search query for court opinions (e.g., 'immigration', 'copyright', 'constitutional')",
            },
            court: {
              type: "string",
              description:
                "Optional court filter (e.g., 'scotus', 'ca1', 'ca2')",
            },
            limit: {
              type: "number",
              description: "Number of results to return (max 50)",
              minimum: 1,
              maximum: 50,
              default: 20,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_recent_court_opinions",
        description:
          "Get the most recently published court opinions from CourtListener",
        inputSchema: {
          type: "object",
          properties: {
            court: {
              type: "string",
              description:
                "Optional court filter (e.g., 'scotus', 'ca1', 'ca2')",
            },
            limit: {
              type: "number",
              description: "Number of results to return (max 50)",
              minimum: 1,
              maximum: 50,
              default: 20,
            },
          },
        },
      },
      {
        name: "get_congress_committees",
        description: "Get list of Congressional committees",
        inputSchema: {
          type: "object",
          properties: {
            congress: {
              type: "number",
              description: "Congress number (e.g., 118 for current Congress)",
              minimum: 100,
              maximum: 120,
            },
            chamber: {
              type: "string",
              enum: ["House", "Senate"],
              description: "Chamber filter (House or Senate)",
            },
          },
        },
      },
      {
        name: "get_genius_act_info",
        description:
          "Curated reference for the GENIUS Act (Guiding and Establishing National Innovation for U.S. Stablecoins Act, S.1582, 119th Cong., Pub. L. 119-27). Returns status, timeline, sponsors, key provisions, agency jurisdiction, and source links. For live bill actions use get_bill_actions with billId 's1582-119'.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_clarity_act_info",
        description:
          "Curated reference for the Digital Asset Market CLARITY Act (H.R.3633, 119th Cong.). Returns status, timeline, sponsor, key provisions, agency jurisdiction (SEC/CFTC), and source links. For live bill actions use get_bill_actions with billId 'hr3633-119'.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_curated_act",
        description:
          "Return a curated reference record for a major US digital-asset act by slug.",
        inputSchema: {
          type: "object",
          properties: {
            slug: {
              type: "string",
              enum: ["genius-act", "clarity-act"],
              description: "Which act to return.",
            },
          },
          required: ["slug"],
        },
      },
      {
        name: "get_bill_details",
        description:
          "Fetch live bill metadata from the Congress.gov API (sponsors, latest action, policy area, linked endpoints). Identify the bill by billId (e.g. 's1582-119', 'hr3633-119') OR by explicit congress+type+number.",
        inputSchema: {
          type: "object",
          properties: {
            billId: {
              type: "string",
              description:
                "Canonical id like 's1582-119' or 'hr3633-119'. Takes precedence over congress/type/number.",
            },
            congress: { type: "number", minimum: 100, maximum: 120 },
            type: {
              type: "string",
              description:
                "Bill type (hr, s, hres, sres, hjres, sjres, hconres, sconres).",
            },
            number: { type: "number", minimum: 1 },
          },
        },
      },
      {
        name: "get_bill_actions",
        description:
          "Chronological actions (newest first) for a specific bill from Congress.gov. Identify via billId or congress+type+number.",
        inputSchema: {
          type: "object",
          properties: {
            billId: { type: "string" },
            congress: { type: "number", minimum: 100, maximum: 120 },
            type: { type: "string" },
            number: { type: "number", minimum: 1 },
            limit: {
              type: "number",
              description: "Max actions to return (default 50, max 250).",
              minimum: 1,
              maximum: 250,
              default: 50,
            },
          },
        },
      },
      {
        name: "get_bill_text",
        description:
          "List available text versions (Introduced, Engrossed, Enrolled, etc.) with PDF/HTML/XML download links for a bill.",
        inputSchema: {
          type: "object",
          properties: {
            billId: { type: "string" },
            congress: { type: "number", minimum: 100, maximum: 120 },
            type: { type: "string" },
            number: { type: "number", minimum: 1 },
          },
        },
      },
      {
        name: "get_public_law_text",
        description:
          "Fetch a Public Law package from GovInfo (summary + optional truncated plain text). Example: congress=119, lawNumber=27 returns the GENIUS Act.",
        inputSchema: {
          type: "object",
          properties: {
            congress: {
              type: "number",
              description: "Congress that enacted the law (e.g., 119).",
              minimum: 100,
              maximum: 120,
            },
            lawNumber: {
              type: "number",
              description:
                "Public law number within that Congress (e.g., 27 for 119-27).",
              minimum: 1,
            },
            includeText: {
              type: "boolean",
              description:
                "Whether to also fetch and include the law text (truncated). Default true.",
              default: true,
            },
            maxChars: {
              type: "number",
              description: "Truncation length for inline text (default 20000).",
              minimum: 1000,
              maximum: 100000,
              default: 20000,
            },
          },
          required: ["congress", "lawNumber"],
        },
      },
      {
        name: "get_recent_regulator_news",
        description:
          "Recent press releases / news items from a US financial regulator (OCC, SEC, CFTC, Federal Reserve, Treasury, FinCEN) or all of them.",
        inputSchema: {
          type: "object",
          properties: {
            source: {
              type: "string",
              enum: ["occ", "sec", "cftc", "fed", "treasury", "fincen", "all"],
              default: "all",
              description:
                "Regulator to pull from. 'all' fans out in parallel.",
            },
            limit: {
              type: "number",
              description: "Max items to return (default 15).",
              minimum: 1,
              maximum: 100,
              default: 15,
            },
          },
        },
      },
      {
        name: "search_regulator_news",
        description:
          "Keyword search across regulator press-release feeds (OCC, SEC, CFTC, Fed, Treasury, FinCEN). Useful for stablecoin/CBDC/digital-asset monitoring.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Keyword or phrase, e.g. 'stablecoin', 'CBDC', 'digital asset'.",
            },
            source: {
              type: "string",
              enum: ["occ", "sec", "cftc", "fed", "treasury", "fincen", "all"],
              default: "all",
            },
            limit: {
              type: "number",
              minimum: 1,
              maximum: 100,
              default: 15,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_digital_asset_regulation",
        description:
          "Aggregate search across Congress bills, Federal Register, and all regulator news feeds. Scoped to digital-asset / crypto / stablecoin topics.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Keyword or phrase (e.g. 'stablecoin reserves', 'digital commodity', 'market structure').",
            },
            limit: {
              type: "number",
              minimum: 1,
              maximum: 50,
              default: 15,
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🇺🇸 US Legal MCP Server running on stdio");
}

main().catch(console.error);
