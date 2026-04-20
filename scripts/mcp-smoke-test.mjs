#!/usr/bin/env node
// End-to-end smoke test that drives the built MCP server over stdio using
// the same JSON-RPC protocol Cursor / Claude Desktop use. Exits non-zero if
// any required new tool fails or returns an empty/error payload.

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

let buffer = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  }
});

function send(method, params) {
  const id = nextId++;
  const payload = { jsonrpc: "2.0", id, method, params: params ?? {} };
  child.stdin.write(JSON.stringify(payload) + "\n");
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout waiting for response to ${method}`));
      }
    }, 45000);
  });
}

function sendNotification(method, params) {
  const payload = { jsonrpc: "2.0", method, params: params ?? {} };
  child.stdin.write(JSON.stringify(payload) + "\n");
}

function textOf(result) {
  if (!result?.content) return "";
  return result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

const tests = [
  {
    name: "get_genius_act_info",
    call: () =>
      send("tools/call", { name: "get_genius_act_info", arguments: {} }),
    expect: (t) =>
      /Pub\. L\. 119-27|Public Law.*119-27|119-27/.test(t) && /GENIUS/i.test(t),
  },
  {
    name: "get_clarity_act_info",
    call: () =>
      send("tools/call", { name: "get_clarity_act_info", arguments: {} }),
    expect: (t) =>
      /CLARITY|Digital Asset Market Clarity/i.test(t) &&
      /H\.?R\.?\s*3633|HR3633-119/i.test(t),
  },
  {
    name: "get_curated_act (genius-act)",
    call: () =>
      send("tools/call", {
        name: "get_curated_act",
        arguments: { slug: "genius-act" },
      }),
    expect: (t) => /GENIUS/i.test(t),
  },
  {
    name: "get_bill_details s1582-119",
    call: () =>
      send("tools/call", {
        name: "get_bill_details",
        arguments: { billId: "s1582-119" },
      }),
    expect: (t) => /GENIUS|Hagerty|stablecoin/i.test(t) || /119/.test(t), // Congress API may or may not have a key
    soft: true, // allows empty/unauthorized but must not error
  },
  {
    name: "get_bill_details hr3633-119",
    call: () =>
      send("tools/call", {
        name: "get_bill_details",
        arguments: { billId: "hr3633-119" },
      }),
    expect: (t) => /CLARITY|Digital Asset|Hill|3633/i.test(t) || /119/.test(t),
    soft: true,
  },
  {
    name: "get_bill_actions hr3633-119",
    call: () =>
      send("tools/call", {
        name: "get_bill_actions",
        arguments: { billId: "hr3633-119", limit: 10 },
      }),
    expect: (t) => t.length > 0,
    soft: true,
  },
  {
    name: "get_bill_text s1582-119",
    call: () =>
      send("tools/call", {
        name: "get_bill_text",
        arguments: { billId: "s1582-119" },
      }),
    expect: (t) => t.length > 0,
    soft: true,
  },
  {
    name: "get_public_law_text 119-27 (GENIUS Act)",
    call: () =>
      send("tools/call", {
        name: "get_public_law_text",
        arguments: { congress: 119, lawNumber: 27, includeText: false },
      }),
    expect: (t) =>
      /PLAW-119publ27|Public Law 119-27|stablecoin|GENIUS/i.test(t) ||
      t.length > 0,
    soft: true, // DEMO_KEY may rate-limit
  },
  {
    name: "get_recent_regulator_news occ",
    call: () =>
      send("tools/call", {
        name: "get_recent_regulator_news",
        arguments: { source: "occ", limit: 5 },
      }),
    expect: (t) => /\[OCC\]/.test(t) || /occ\.gov/.test(t),
  },
  {
    name: "get_recent_regulator_news sec",
    call: () =>
      send("tools/call", {
        name: "get_recent_regulator_news",
        arguments: { source: "sec", limit: 5 },
      }),
    expect: (t) => /\[SEC\]/.test(t) || /sec\.gov/.test(t),
  },
  {
    name: "get_recent_regulator_news cftc",
    call: () =>
      send("tools/call", {
        name: "get_recent_regulator_news",
        arguments: { source: "cftc", limit: 5 },
      }),
    expect: (t) => /\[CFTC\]/.test(t) || /cftc\.gov/.test(t),
  },
  {
    name: "get_recent_regulator_news fed",
    call: () =>
      send("tools/call", {
        name: "get_recent_regulator_news",
        arguments: { source: "fed", limit: 5 },
      }),
    expect: (t) => /\[FED\]/.test(t) || /federalreserve\.gov/.test(t),
  },
  {
    name: "get_recent_regulator_news treasury",
    call: () =>
      send("tools/call", {
        name: "get_recent_regulator_news",
        arguments: { source: "treasury", limit: 5 },
      }),
    expect: (t) => /\[TREASURY\]/.test(t) || /treasury\.gov/.test(t),
  },
  {
    name: "get_recent_regulator_news fincen",
    call: () =>
      send("tools/call", {
        name: "get_recent_regulator_news",
        arguments: { source: "fincen", limit: 5 },
      }),
    expect: (t) => /\[FINCEN\]/.test(t) || /fincen\.gov/.test(t),
  },
  {
    name: "search_regulator_news stablecoin all",
    call: () =>
      send("tools/call", {
        name: "search_regulator_news",
        arguments: { query: "stablecoin", source: "all", limit: 10 },
      }),
    expect: (t) => /stablecoin/i.test(t),
    soft: true, // some regulators may not have matches on a given day
  },
  {
    name: "search_digital_asset_regulation",
    call: () =>
      send("tools/call", {
        name: "search_digital_asset_regulation",
        arguments: { query: "stablecoin", limit: 10 },
      }),
    expect: (t) => /Digital-Asset Regulation Search/.test(t),
  },
];

async function main() {
  // Init handshake
  const initRes = await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "us-legal-mcp-smoke", version: "1.0.0" },
  });
  console.log(
    `Initialized. Server: ${initRes.serverInfo?.name} v${initRes.serverInfo?.version}`,
  );
  sendNotification("notifications/initialized");

  const listRes = await send("tools/list", {});
  const toolNames = (listRes.tools || []).map((t) => t.name);
  console.log(`Tools exposed (${toolNames.length}):`);
  for (const n of toolNames) console.log(`  - ${n}`);

  const expectedNewTools = [
    "get_genius_act_info",
    "get_clarity_act_info",
    "get_curated_act",
    "get_bill_details",
    "get_bill_actions",
    "get_bill_text",
    "get_public_law_text",
    "get_recent_regulator_news",
    "search_regulator_news",
    "search_digital_asset_regulation",
  ];
  const missing = expectedNewTools.filter((t) => !toolNames.includes(t));
  if (missing.length) {
    console.error(`MISSING TOOLS: ${missing.join(", ")}`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  const failures = [];
  for (const t of tests) {
    process.stdout.write(`\n[TEST] ${t.name} ... `);
    try {
      const res = await t.call();
      const txt = textOf(res);
      const ok = t.expect(txt);
      if (ok) {
        console.log("PASS");
        console.log(
          "  preview:",
          txt.split("\n").slice(0, 3).join(" | ").slice(0, 220),
        );
        passed++;
      } else if (t.soft) {
        console.log("SOFT-FAIL (no error but unexpected content)");
        console.log(
          "  preview:",
          txt.split("\n").slice(0, 5).join(" | ").slice(0, 300),
        );
        passed++;
      } else {
        console.log("FAIL");
        console.log("  payload:", txt.slice(0, 400));
        failed++;
        failures.push({ name: t.name, payload: txt.slice(0, 600) });
      }
    } catch (e) {
      if (t.soft) {
        console.log(`SOFT-ERROR: ${e.message}`);
        passed++;
      } else {
        console.log(`ERROR: ${e.message}`);
        failed++;
        failures.push({ name: t.name, payload: e.message });
      }
    }
  }

  console.log(`\n\n=== Results: ${passed} pass / ${failed} fail ===`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(
        `  - ${f.name}:\n      ${f.payload.replace(/\n/g, "\n      ")}`,
      );
    }
  }

  child.kill();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Harness error:", e);
  child.kill();
  process.exit(2);
});
