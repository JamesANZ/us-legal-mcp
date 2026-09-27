#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the package directory (when installed via npm, this is in node_modules)
// __dirname points to scripts/, so go up one level to get package root
const packageDir = resolve(__dirname, "..");
const distPath = resolve(packageDir, "dist", "index.js");

// Determine Claude Desktop config path based on OS
const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";
const isLinux = process.platform === "linux";

let claudeConfigPath;
if (isMac) {
  claudeConfigPath = join(
    process.env.HOME,
    "Library",
    "Application Support",
    "Claude",
    "claude_desktop_config.json",
  );
} else if (isWindows) {
  claudeConfigPath = join(
    process.env.APPDATA || process.env.LOCALAPPDATA,
    "Claude",
    "claude_desktop_config.json",
  );
} else if (isLinux) {
  claudeConfigPath = join(
    process.env.HOME,
    ".config",
    "Claude",
    "claude_desktop_config.json",
  );
}

if (!claudeConfigPath) {
  console.log("⚠️  Could not determine Claude Desktop config path for this OS");
  process.exit(0);
}

// Read existing config or create new one
let config = { mcpServers: {} };

if (existsSync(claudeConfigPath)) {
  try {
    const configContent = readFileSync(claudeConfigPath, "utf8");
    config = JSON.parse(configContent);
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
  } catch (error) {
    console.error("Error reading Claude config:", error.message);
    config = { mcpServers: {} };
  }
}

// Use absolute path for the dist file
const finalDistPath = distPath;
const distExists = existsSync(finalDistPath);

if (!distExists) {
  console.log(
    "⚠️  dist/index.js not found. Please run 'npm run build' after installation.",
  );
}

// Get node executable path
const nodePath = process.execPath;

// Configure the MCP server
// Use absolute path to ensure it works when installed via npm
const serverConfig = {
  command: nodePath,
  args: [finalDistPath],
  env: {
    CONGRESS_API_KEY: process.env.CONGRESS_API_KEY || "",
    COURT_LISTENER_API_KEY:
      process.env.COURT_LISTENER_API_KEY ||
      "258021eb4dd1901f1acfdb3f521fb8a7837a9097",
    GOVINFO_API_KEY: process.env.GOVINFO_API_KEY || "",
    TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY || "",
  },
};

// Update or add the server config
const serverName = "us-legal-mcp";
const alreadyConfigured =
  config.mcpServers[serverName] &&
  JSON.stringify(config.mcpServers[serverName].args) ===
    JSON.stringify(serverConfig.args);

if (alreadyConfigured) {
  // Update existing config, preserve user's API keys if set
  if (
    config.mcpServers[serverName].env &&
    config.mcpServers[serverName].env.CONGRESS_API_KEY
  ) {
    serverConfig.env.CONGRESS_API_KEY =
      config.mcpServers[serverName].env.CONGRESS_API_KEY;
  }
  if (
    config.mcpServers[serverName].env &&
    config.mcpServers[serverName].env.COURT_LISTENER_API_KEY
  ) {
    serverConfig.env.COURT_LISTENER_API_KEY =
      config.mcpServers[serverName].env.COURT_LISTENER_API_KEY;
  }
  if (
    config.mcpServers[serverName].env &&
    config.mcpServers[serverName].env.GOVINFO_API_KEY
  ) {
    serverConfig.env.GOVINFO_API_KEY =
      config.mcpServers[serverName].env.GOVINFO_API_KEY;
  }
  if (
    config.mcpServers[serverName].env &&
    config.mcpServers[serverName].env.TYPESAFE_API_KEY
  ) {
    serverConfig.env.TYPESAFE_API_KEY =
      config.mcpServers[serverName].env.TYPESAFE_API_KEY;
  }
  if (
    config.mcpServers[serverName].env &&
    config.mcpServers[serverName].env.JEV_API_KEY
  ) {
    serverConfig.env.JEV_API_KEY =
      config.mcpServers[serverName].env.JEV_API_KEY;
  }
}

config.mcpServers[serverName] = serverConfig;

// Ensure directory exists
try {
  mkdirSync(dirname(claudeConfigPath), { recursive: true });
} catch (error) {
  // Directory might already exist, that's fine
}

// Write updated config
try {
  writeFileSync(
    claudeConfigPath,
    JSON.stringify(config, null, 2) + "\n",
    "utf8",
  );
  console.log(`✅ Claude Desktop config updated: ${claudeConfigPath}`);
  console.log(`   MCP server "${serverName}" configured`);
  console.log(`   Server path: ${finalDistPath}`);
  if (!distExists) {
    console.log(
      `   ⚠️  Don't forget to run 'npm run build' to compile TypeScript`,
    );
  }
} catch (error) {
  console.error("Error writing Claude config:", error.message);
  console.error(
    `Please manually add the MCP server config to: ${claudeConfigPath}`,
  );
  process.exit(1);
}
