#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import USLegalAPI from "./us-legal-apis.js";

// Initialize US Legal API
const usLegalAPI = new USLegalAPI({
  congress: process.env.CONGRESS_API_KEY,
  regulationsGov: process.env.REGULATIONS_GOV_API_KEY,
  courtListener: process.env.COURT_LISTENER_API_KEY,
});

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
        const bills = await usLegalAPI.congress.searchBills(
          query,
          congress,
          limit,
        );

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

      case "search_us_code": {
        const { query, title, limit } = args as {
          query: string;
          title?: number;
          limit?: number;
        };
        const sections = await usLegalAPI.usCode.searchCode(
          query,
          title,
          limit,
        );

        return {
          content: [
            {
              type: "text",
              text:
                `**US Code Search Results for "${query}"**\n\nFound ${sections.length} result(s)\n\n` +
                sections
                  .map(
                    (section, index) =>
                      `${index + 1}. **Section ${section.section}**\n   Title ${section.title}, Section ${section.section}\n   ${section.url}\n`,
                  )
                  .join("\n"),
            },
          ],
        };
      }

      case "search_public_comments": {
        const { query, limit } = args as { query: string; limit?: number };
        const comments = await usLegalAPI.regulations.searchComments(
          query,
          limit,
        );

        return {
          content: [
            {
              type: "text",
              text:
                `**Public Comments Search Results for "${query}"**\n\nFound ${comments.length} result(s)\n\n` +
                comments
                  .map(
                    (comment: any, index: number) =>
                      `${index + 1}. **${comment.title}**\n   ${comment.organization} - ${comment.posted_date}\n   ${comment.url}\n`,
                  )
                  .join("\n"),
            },
          ],
        };
      }

      case "search_all_legal": {
        const { query, limit } = args as { query: string; limit?: number };
        const results = await usLegalAPI.searchAll(query, limit);

        return {
          content: [
            {
              type: "text",
              text:
                `**Comprehensive US Legal Search Results for "${query}"**\n\n` +
                `- Bills: ${results.bills.length}\n` +
                `- Regulations: ${results.regulations.length}\n` +
                `- Code Sections: ${results.codeSections.length}\n` +
                `- Comments: ${results.comments.length}\n\n` +
                `**Top Results:**\n\n` +
                results.bills
                  .slice(0, 3)
                  .map(
                    (bill, index) =>
                      `${index + 1}. **${bill.title}** (Bill)\n   ${bill.type} ${bill.number}\n   ${bill.url}\n`,
                  )
                  .join("\n") +
                results.regulations
                  .slice(0, 3)
                  .map(
                    (doc, index) =>
                      `${index + 1}. **${doc.title}** (Regulation)\n   ${doc.document_number}\n   ${doc.html_url}\n`,
                  )
                  .join("\n"),
            },
          ],
        };
      }

      case "get_recent_bills": {
        const { congress, limit } = args as {
          congress?: number;
          limit?: number;
        };
        const bills = await usLegalAPI.congress.getRecentBills(congress, limit);

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
        const opinions = await usLegalAPI.courtListener.searchOpinions(
          query,
          court,
          limit,
        );

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
      }

      case "get_recent_court_opinions": {
        const { court, limit } = args as {
          court?: string;
          limit?: number;
        };
        const opinions = await usLegalAPI.courtListener.getRecentOpinions(
          court,
          limit,
        );

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
      }

      case "search_congress_votes": {
        const { congress, chamber, limit } = args as {
          congress?: number;
          chamber?: "House" | "Senate";
          limit?: number;
        };
        const votes = await usLegalAPI.congress.searchVotes(
          congress,
          chamber,
          limit,
        );

        return {
          content: [
            {
              type: "text",
              text:
                `**Congress Votes**\n\nFound ${votes.length} result(s)\n\n` +
                votes
                  .map(
                    (vote, index) =>
                      `${index + 1}. **${vote.voteTitle}**\n   ${vote.chamber} - ${vote.voteDate}\n   Result: ${vote.voteResult}\n   ${vote.url}\n`,
                  )
                  .join("\n"),
            },
          ],
        };
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
        name: "search_us_code",
        description: "Search for sections in the US Code (federal statutes)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for US Code sections",
            },
            title: {
              type: "number",
              description: "Specific title number to search within (optional)",
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
        name: "search_public_comments",
        description:
          "Search for public comments on regulations from Regulations.gov",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for public comments",
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
          "Comprehensive search across all US legal sources (Congress, Federal Register, US Code, Comments)",
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
        name: "search_congress_votes",
        description: "Search for voting records in Congress",
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
