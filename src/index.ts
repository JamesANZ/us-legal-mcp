#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import USLegalAPI from "./us-legal-apis.js";

// Initialize US Legal API
const apiKeys = {
  congress: process.env.CONGRESS_API_KEY,
  regulationsGov: process.env.REGULATIONS_GOV_API_KEY,
  courtListener: process.env.COURT_LISTENER_API_KEY,
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

const usLegalAPI = new USLegalAPI(apiKeys);

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

        // Search only working sources
        const [bills, regulations, opinions] = await Promise.all([
          usLegalAPI.congress.searchBills(
            query,
            undefined,
            Math.ceil((limit || 10) / 3),
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

          return {
            content: [
              {
                type: "text",
                text:
                  `**Court Opinions Search Results for "${query}"**\n\nFound ${opinions.length} result(s)\n\n` +
                  opinions
                    .map(
                      (opinion, index) =>
                        `${index + 1}. **${opinion.case_name}**\n   Court: ${opinion.court} - ${opinion.date_filed}\n   ${opinion.precedential_status}\n   ${opinion.url}\n`,
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

          return {
            content: [
              {
                type: "text",
                text:
                  `**Recent Court Opinions**\n\nFound ${opinions.length} result(s)\n\n` +
                  opinions
                    .map(
                      (opinion, index) =>
                        `${index + 1}. **${opinion.case_name}**\n   Court: ${opinion.court} - ${opinion.date_filed}\n   ${opinion.precedential_status}\n   ${opinion.url}\n`,
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
