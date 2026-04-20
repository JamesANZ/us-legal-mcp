#!/usr/bin/env node
// Dump full MCP tool outputs for every new tool added in this change set.
// Drives the built server over real stdio JSON-RPC (same protocol Cursor uses).

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEntry = path.resolve(__dirname, "..", "dist", "index.js");

const child = spawn(process.execPath, [serverEntry], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env },
});

let buf = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (c) => {
  buf += c.toString();
  let i;
  while ((i = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try {
      const m = JSON.parse(line);
      if (pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        m.error
          ? reject(new Error(JSON.stringify(m.error)))
          : resolve(m.result);
      }
    } catch {}
  }
});

function send(method, params) {
  const id = nextId++;
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", id, method, params: params ?? {} }) + "\n",
  );
  return new Promise((res, rej) => {
    pending.set(id, { resolve: res, reject: rej });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        rej(new Error("timeout"));
      }
    }, 60000);
  });
}
function notify(method, params) {
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method, params: params ?? {} }) + "\n",
  );
}

function textOf(result) {
  if (!result?.content) return "";
  return result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

function header(title) {
  const bar = "=".repeat(Math.max(20, title.length + 10));
  return `\n\n${bar}\n  ${title}\n${bar}\n`;
}

await send("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "dump", version: "1.0" },
});
notify("notifications/initialized");

const calls = [
  ["get_genius_act_info", {}],
  ["get_clarity_act_info", {}],
  ["get_curated_act", { slug: "clarity-act" }],
  ["get_bill_details", { billId: "s1582-119" }],
  ["get_bill_details", { billId: "hr3633-119" }],
  ["get_bill_actions", { billId: "hr3633-119", limit: 15 }],
  ["get_bill_text", { billId: "s1582-119" }],
  ["get_public_law_text", { congress: 119, lawNumber: 27, includeText: false }],
  ["get_recent_regulator_news", { source: "occ", limit: 5 }],
  ["get_recent_regulator_news", { source: "sec", limit: 5 }],
  ["get_recent_regulator_news", { source: "cftc", limit: 5 }],
  ["get_recent_regulator_news", { source: "fed", limit: 5 }],
  ["get_recent_regulator_news", { source: "treasury", limit: 5 }],
  ["get_recent_regulator_news", { source: "fincen", limit: 5 }],
  ["get_recent_regulator_news", { source: "all", limit: 12 }],
  ["search_regulator_news", { query: "stablecoin", source: "all", limit: 10 }],
  ["search_regulator_news", { query: "CBDC", source: "fed", limit: 5 }],
  [
    "search_digital_asset_regulation",
    { query: "digital asset market structure", limit: 10 },
  ],
];

for (const [name, args] of calls) {
  const label = `${name}  ${JSON.stringify(args)}`;
  try {
    const r = await send("tools/call", { name, arguments: args });
    const txt = textOf(r);
    console.log(header(label));
    console.log(txt);
  } catch (e) {
    console.log(header(label));
    console.log(`[TOOL ERROR] ${e.message}`);
  }
}

child.kill();
process.exit(0);
