#!/usr/bin/env node

/**
 * Generate a Cursor MCP install deeplink for legal-mcp
 *
 * Usage: node scripts/generate-cursor-install-link.js
 */

const config = {
  "legal-mcp": {
    command: "npx",
    args: ["-y", "us-legal-mcp"],
  },
};

// Convert to JSON string and Base64 encode
const configString = JSON.stringify(config);
const base64Config = Buffer.from(configString).toString("base64");

// Create the deeplink
const deeplink = `cursor://anysphere.cursor-deeplink/mcp/install?name=legal-mcp&config=${base64Config}`;

console.log("\n🔗 Cursor MCP Install Link:\n");
console.log(deeplink);
console.log("\n📋 Configuration:\n");
console.log(JSON.stringify(config, null, 2));
console.log(
  "\n💡 Note: API keys are optional. Add TYPESAFE_API_KEY (or JEV_API_KEY) in MCP env to enable Jev high-confidence filtering.\n",
);
