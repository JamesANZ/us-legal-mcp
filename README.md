# 🇺🇸 US Legal MCP Server

> **Comprehensive US legal data in your AI workflow.** Search Congress bills, Federal Register documents, court opinions, and committees. No API keys required (optional for enhanced access).

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that brings authoritative US legal information into AI coding environments like Cursor and Claude Desktop.

## Why Use US Legal MCP?

- 🆓 **No API Keys Required** – Works out of the box (optional keys for enhanced access)
- 📜 **Comprehensive Sources** – Congress, Federal Register, CourtListener
- ⚡ **Easy Setup** – One-click install in Cursor or simple manual setup
- 🔍 **Multi-Source Search** – Search across all legal sources simultaneously
- 📊 **Real-time Data** – Recent bills, regulations, and court opinions

## Quick Start

Ready to explore US legal data? Install in seconds:

**Install in Cursor (Recommended):**

[🔗 Install in Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=legal-mcp&config=eyJsZWdhbC1tY3AiOnsiY29tbWFuZCI6Im5weCIsImFyZ3MiOlsiLXkiLCJ1cy1sZWdhbC1tY3AiXX19)

**Or install manually:**

```bash
npm install -g us-legal-mcp
# Or from source:
git clone https://github.com/JamesANZ/legal-mcp.git
cd legal-mcp && npm install && npm run build
```

## Hosted deployment

A hosted deployment is available on [Fronteir AI](https://fronteir.ai/mcp/jamesanz-us-legal-mcp).

## Features

### 📜 Congress.gov
- **`search-congress-bills`** – Search bills and resolutions
- **`get-recent-bills`** – Get recently introduced legislation
- **`get-congress-committees`** – List Congressional committees

### 📋 Federal Register
- **`search-federal-register`** – Search regulations and executive orders
- **`get-recent-regulations`** – Get recently published documents

### ⚖️ CourtListener
- **`search-court-opinions`** – Search court opinions (federal and state)
- **`get-recent-court-opinions`** – Get recent court decisions

### 🔍 Multi-Source
- **`search-all-legal`** – Comprehensive search across all sources

## Installation

### Cursor (One-Click)

Click the install link above or use:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=legal-mcp&config=eyJsZWdhbC1tY3AiOnsiY29tbWFuZCI6Im5weCIsImFyZ3MiOlsiLXkiLCJ1cy1sZWdhbC1tY3AiXX19
```

### Manual Installation

**Requirements:** Node.js 18+ and npm

```bash
# Clone and build
git clone https://github.com/JamesANZ/legal-mcp.git
cd legal-mcp
npm install
npm run build

# Run server
npm start
```

### Claude Desktop

Add to `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "us-legal-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/legal-mcp/dist/index.js"],
      "env": {
        "CONGRESS_API_KEY": "",
        "COURT_LISTENER_API_KEY": ""
      }
    }
  }
}
```

Restart Claude Desktop after configuration.

## Usage Examples

### Search Congress Bills
Find bills related to a specific topic:

```json
{
  "tool": "search-congress-bills",
  "arguments": {
    "query": "immigration",
    "congress": 118,
    "limit": 10
  }
}
```

### Search Federal Regulations
Find regulations on a topic:

```json
{
  "tool": "search-federal-register",
  "arguments": {
    "query": "environmental protection",
    "limit": 5
  }
}
```

### Comprehensive Legal Search
Search across all sources simultaneously:

```json
{
  "tool": "search-all-legal",
  "arguments": {
    "query": "healthcare",
    "limit": 20
  }
}
```

### Search Court Opinions
Find court decisions:

```json
{
  "tool": "search-court-opinions",
  "arguments": {
    "query": "immigration asylum",
    "court": "scotus",
    "limit": 10
  }
}
```

## Data Sources

| Source | Description | API | Auth Required |
|--------|-------------|-----|---------------|
| **Congress.gov** | Bills, resolutions, committees | https://api.congress.gov/v3 | Optional |
| **Federal Register** | Regulations, executive orders | https://www.federalregister.gov/api/v1 | No |
| **CourtListener** | Court opinions, decisions | https://www.courtlistener.com/api/ | Optional |

## API Keys (Optional)

### Congress.gov API Key
1. Visit [https://api.congress.gov/](https://api.congress.gov/)
2. Sign up for a free account
3. Get your API key
4. Set `CONGRESS_API_KEY` environment variable

### CourtListener API Key
1. Visit [https://www.courtlistener.com/api/](https://www.courtlistener.com/api/)
2. Create a free account
3. Get your API key from your profile
4. Set `COURT_LISTENER_API_KEY` environment variable

## Use Cases

- **Legal Researchers** – Quick access to bills, regulations, and court opinions
- **Policy Analysts** – Track legislation and regulatory changes
- **Lawyers** – Reference tool for case law and regulations
- **Developers** – Build apps with authoritative legal data

## Technical Details

**Built with:** Node.js, TypeScript, MCP SDK  
**Dependencies:** `@modelcontextprotocol/sdk`, `superagent`, `zod`  
**Platforms:** macOS, Windows, Linux

## Contributing

⭐ **If this project helps you, please star it on GitHub!** ⭐

Contributions welcome! Please open an issue or submit a pull request.

## License

MIT License – see LICENSE file for details.

## Support

If you find this project useful, consider supporting it:

**⚡ Lightning Network**
```
lnbc1pjhhsqepp5mjgwnvg0z53shm22hfe9us289lnaqkwv8rn2s0rtekg5vvj56xnqdqqcqzzsxqyz5vqsp5gu6vh9hyp94c7t3tkpqrp2r059t4vrw7ps78a4n0a2u52678c7yq9qyyssq7zcferywka50wcy75skjfrdrk930cuyx24rg55cwfuzxs49rc9c53mpz6zug5y2544pt8y9jflnq0ltlha26ed846jh0y7n4gm8jd3qqaautqa
```

**₿ Bitcoin**: [bc1ptzvr93pn959xq4et6sqzpfnkk2args22ewv5u2th4ps7hshfaqrshe0xtp](https://mempool.space/address/bc1ptzvr93pn959xq4et6sqzpfnkk2args22ewv5u2th4ps7hshfaqrshe0xtp)

**Ξ Ethereum/EVM**: [0x42ea529282DDE0AA87B42d9E83316eb23FE62c3f](https://etherscan.io/address/0x42ea529282DDE0AA87B42d9E83316eb23FE62c3f)
