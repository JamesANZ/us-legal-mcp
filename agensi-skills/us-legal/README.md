# US legal

Searches Congress, the Federal Register, court opinions, and US regulator news. Congress.gov, GovInfo, and CourtListener keys are optional and stay in the buyer's MCP env.

## Connect

```json
{
  "mcpServers": {
    "us-legal-mcp": {
      "command": "npx",
      "args": ["-y", "us-legal-mcp"],
      "env": {
        "CONGRESS_API_KEY": "",
        "COURT_LISTENER_API_KEY": "",
        "GOVINFO_API_KEY": ""
      }
    }
  }
}
```

Leave a key blank to skip that source's higher quota. `TYPESAFE_API_KEY` (alias `JEV_API_KEY`) is optional. When set, query search tools keep only high-confidence matches.

## Package this listing

```bash
cd agensi-skills
zip -r us-legal.zip us-legal -x "*.DS_Store"
```

Upload `us-legal.zip` in the Agensi creator dashboard. This repository does not submit the listing.
