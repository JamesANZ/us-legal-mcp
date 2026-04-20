#!/usr/bin/env node
// Exercise the tightened search_digital_asset_regulation tool across a few queries.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(__dirname, "../dist/index.js");

function start() {
  const env = {
    ...process.env,
    CONGRESS_API_KEY: process.env.CONGRESS_API_KEY || "",
    COURT_LISTENER_API_KEY: process.env.COURT_LISTENER_API_KEY || "",
    GOVINFO_API_KEY: process.env.GOVINFO_API_KEY || "",
  };
  const proc = spawn(process.execPath, [SERVER], {
    stdio: ["pipe", "pipe", "pipe"],
    env,
  });
  proc.stderr.on("data", () => {}); // silence startup logs
  return proc;
}

function rpc(proc, id, method, params) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === id) {
            proc.stdout.off("data", onData);
            resolve(msg);
            return;
          }
        } catch {}
      }
    };
    proc.stdout.on("data", onData);
    proc.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n",
    );
    setTimeout(() => {
      proc.stdout.off("data", onData);
      reject(new Error(`RPC ${method} timeout`));
    }, 60000);
  });
}

const queries = [
  "digital asset market structure",
  "stablecoin reserves",
  "CBDC",
  "GENIUS Act",
  "payment stablecoin",
  "crypto exchange registration",
  "quantum computing" /* negative control */,
];

const proc = start();
try {
  await rpc(proc, 1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "search-test", version: "0.0.1" },
  });
  let id = 2;
  for (const q of queries) {
    const res = await rpc(proc, id++, "tools/call", {
      name: "search_digital_asset_regulation",
      arguments: { query: q, limit: 8 },
    });
    const text = res?.result?.content?.[0]?.text || "(no output)";
    console.log(
      `\n==================================================================\n  query: ${q}\n==================================================================\n`,
    );
    console.log(text);
  }
} finally {
  proc.kill("SIGTERM");
}
