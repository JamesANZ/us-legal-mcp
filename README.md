# 🇺🇸 US Legal MCP Server

A comprehensive Model Context Protocol (MCP) server for US legal data, providing access to Congress bills, Federal Register documents, court opinions, and committee data.

## ✨ Features

### 📜 **Congress.gov Integration**

- Search bills and resolutions
- Get recent legislation
- Get committee information
- Real-time legislative data

### 📋 **Federal Register Integration**

- Search regulations and executive orders
- Get recent agency documents
- Full document text and metadata

### ⚖️ **CourtListener Integration**

- Search court opinions (federal and state courts)
- Get recent court decisions
- Access Supreme Court, appellate, and state court data
- Full case text and metadata

### 🗳️ **Congress Committees**

- Get committee information
- Filter by chamber (House/Senate)
- Legislative activity tracking

## 🚀 Quick Start

### Installation

#### Installing in Cursor

You can install this MCP server directly in Cursor using the one-click install link:

**🔗 [Install in Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=legal-mcp&config=eyJsZWdhbC1tY3AiOnsiY29tbWFuZCI6Im5weCIsImFyZ3MiOlsiLXkiLCJ1cy1sZWdhbC1tY3AiXX19)**

This will automatically configure the MCP server using `npx`. No API keys are required (optional API keys available for enhanced access).

**Generate a new install link:** Run `npm run generate-cursor-link` to generate a fresh install link with the latest configuration.

#### Install from Source

```bash
npm install
npm run build
```

### Environment Variables (Optional)

```bash
# For enhanced Congress.gov access (free tier available)
export CONGRESS_API_KEY="your_congress_api_key"

# For CourtListener API access (free tier available)
export COURT_LISTENER_API_KEY="your_court_listener_api_key"
```

### Running the Server

```bash
npm start
```

### MCP Configuration (Cursor/Claude)

To use this MCP server with Cursor or Claude Desktop, add the following configuration:

#### For Cursor

Create or edit `~/.cursor/mcp.json` (or your Cursor MCP config location):

```json
{
  "mcpServers": {
    "us-legal-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/legal-mcp/dist/index.js"],
      "env": {
        "CONGRESS_API_KEY": "",
        "COURT_LISTENER_API_KEY": "258021eb4dd1901f1acfdb3f521fb8a7837a9097"
      }
    }
  }
}
```

**Important**: Replace `/absolute/path/to/legal-mcp` with your actual project path.

#### For Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "us-legal-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/legal-mcp/dist/index.js"],
      "env": {
        "CONGRESS_API_KEY": "",
        "COURT_LISTENER_API_KEY": "258021eb4dd1901f1acfdb3f521fb8a7837a9097"
      }
    }
  }
}
```

See `mcp-config-example.json` in this repository for a reference configuration.

## 🛠️ Available Tools

### `search-congress-bills`

Search for bills and resolutions in Congress.gov

- **Query**: Search terms (e.g., "immigration", "healthcare")
- **Congress**: Optional Congress number (100-120)
- **Limit**: Number of results (1-50)

### `search-federal-register`

Search Federal Register documents (regulations, executive orders)

- **Query**: Search terms
- **Limit**: Number of results (1-50)

### `search-all-legal`

Comprehensive search across all working sources (Congress Bills, Federal Register, Court Opinions)

- **Query**: Search terms
- **Limit**: Results per source (1-50)

### `get-recent-bills`

Get recently introduced bills

- **Congress**: Optional Congress number
- **Limit**: Number of results (1-50)

### `get-recent-regulations`

Get recently published Federal Register documents

- **Limit**: Number of results (1-50)

### `search-court-opinions`

Search for court opinions and decisions

- **Query**: Search terms (e.g., "constitutional", "copyright")
- **Court**: Optional court filter (e.g., "scotus", "ca1", "ca2")
- **Limit**: Number of results (1-50)

### `get-recent-court-opinions`

Get the most recently published court opinions

- **Court**: Optional court filter
- **Limit**: Number of results (1-50)

### `get-congress-committees`

Get list of Congressional committees

- **Congress**: Optional Congress number (100-120)
- **Chamber**: Optional filter ("House" or "Senate")

## 📊 Data Sources

| Source               | Description                    | API                                    | Auth Required | Status |
| -------------------- | ------------------------------ | -------------------------------------- | ------------- | ------ |
| **Congress.gov**     | Bills, resolutions, committees | https://api.congress.gov/v3            | Optional      | ✅     |
| **Federal Register** | Regulations, executive orders  | https://www.federalregister.gov/api/v1 | No            | ✅     |
| **CourtListener**    | Court opinions, decisions      | https://www.courtlistener.com/api/     | Optional      | ✅     |

**Note:** US Code and Regulations.gov integrations were removed due to persistent API reliability issues.

## 🔑 API Keys

### Congress.gov API Key (Optional)

1. Visit [https://api.congress.gov/](https://api.congress.gov/)
2. Sign up for a free account
3. Get your API key
4. Set `CONGRESS_API_KEY` environment variable

### CourtListener API Key (Optional)

1. Visit [https://www.courtlistener.com/api/](https://www.courtlistener.com/api/)
2. Create a free account
3. Get your API key from your profile
4. Set `COURT_LISTENER_API_KEY` environment variable

**Note**: A pre-configured API key is included in the example MCP config file for quick setup.

## 🎯 Example Usage

### Search for Immigration Bills

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

### Get Congressional Committees

```json
{
  "tool": "get-congress-committees",
  "arguments": {
    "congress": 119,
    "chamber": "Senate"
  }
}
```

## Donate

If you find this project useful, consider supporting it with Bitcoin:

**⚡ Lightning Network**

<img src="https://raw.githubusercontent.com/bitcoinwarrior1/CitySats/main/public/lightning.jpeg" alt="Lightning QR Code" width="120" />

<code>lnbc1pjhhsqepp5mjgwnvg0z53shm22hfe9us289lnaqkwv8rn2s0rtekg5vvj56xnqdqqcqzzsxqyz5vqsp5gu6vh9hyp94c7t3tkpqrp2r059t4vrw7ps78a4n0a2u52678c7yq9qyyssq7zcferywka50wcy75skjfrdrk930cuyx24rg55cwfuzxs49rc9c53mpz6zug5y2544pt8y9jflnq0ltlha26ed846jh0y7n4gm8jd3qqaautqa</code>

**₿ On-Chain**

<img src="https://raw.githubusercontent.com/bitcoinwarrior1/CitySats/main/public/onchain.jpg" alt="Bitcoin Address QR Code" width="120" />

<code>[bc1ptzvr93pn959xq4et6sqzpfnkk2args22ewv5u2th4ps7hshfaqrshe0xtp](https://mempool.space/address/bc1ptzvr93pn959xq4et6sqzpfnkk2args22ewv5u2th4ps7hshfaqrshe0xtp)</code>

**Ξ Ethereum / EVM Networks**

<img src="https://raw.githubusercontent.com/bitcoinwarrior1/CitySats/main/public/ethereum.jpg" alt="Ethereum Address QR Code" width="120" />

<code>[0x42ea529282DDE0AA87B42d9E83316eb23FE62c3f](https://etherscan.io/address/0x42ea529282DDE0AA87B42d9E83316eb23FE62c3f)</code>

*Donations from any EVM-compatible network (Ethereum, Polygon, Arbitrum, Optimism, BSC, Avalanche, etc.) will work perfectly! You can also send tokens like USDT, USDC, DAI, and other ERC-20 tokens to this address.*

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please read the contributing guidelines and submit pull requests.
