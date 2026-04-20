#!/usr/bin/env node
// Quick verification of the two general-search tools after the tighten.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(__dirname, "../dist/index.js");

const proc = spawn(process.execPath, [SERVER], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env },
});
proc.stderr.on("data", () => {});

function rpc(id, method, params) {
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
      reject(new Error("timeout"));
    }, 30000);
  });
}

try {
  await rpc(1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "quick", version: "0.0.1" },
  });
  const cases = [
    ["search_all_legal", { query: "stablecoin", limit: 10 }],
    ["search_congress_bills", { query: "stablecoin", limit: 5 }],
    ["search_congress_bills", { query: "quantum computing", limit: 5 }],
    ["get_recent_regulator_news", { source: "occ", limit: 3 }],
  ];
  let id = 2;
  for (const [tool, args] of cases) {
    const t0 = Date.now();
    const res = await rpc(id++, "tools/call", {
      name: tool,
      arguments: args,
    });
    const dt = Date.now() - t0;
    console.log(`\n=== ${tool} ${JSON.stringify(args)}  (${dt}ms) ===\n`);
    console.log(res?.result?.content?.[0]?.text || "(no output)");
  }
} finally {
  proc.kill("SIGTERM");
}
