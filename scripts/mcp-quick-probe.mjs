#!/usr/bin/env node
// Quick full-payload probe of two of the most important tools.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEntry = path.resolve(__dirname, "..", "dist", "index.js");

const child = spawn(process.execPath, [serverEntry], {
  stdio: ["pipe", "pipe", "inherit"],
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
    setTimeout(() => pending.delete(id) && rej(new Error("timeout")), 45000);
  });
}
function notify(method, params) {
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method, params: params ?? {} }) + "\n",
  );
}

await send("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "probe", version: "1.0" },
});
notify("notifications/initialized");

const calls = [
  ["get_public_law_text", { congress: 119, lawNumber: 27, includeText: false }],
  ["search_regulator_news", { query: "stablecoin", source: "all", limit: 10 }],
  ["get_recent_regulator_news", { source: "occ", limit: 3 }],
  ["get_genius_act_info", {}],
];

for (const [name, args] of calls) {
  const r = await send("tools/call", { name, arguments: args });
  const txt = r.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  console.log(`\n===== ${name} =====\n`);
  console.log(txt.slice(0, 3000));
}

child.kill();
process.exit(0);
