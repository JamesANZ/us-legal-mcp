/**
 * HTTP front for one stdio MCP server.
 * The gateway posts one JSON-RPC message at a time and does not keep a session.
 * This process keeps a single stdio session, answers /healthz and /readyz, and
 * forwards each POST /mcp. A second initialize is answered here so the stdio
 * session is not initialized twice.
 */

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";

const entry = resolve(process.env.MCP_ENTRY || "build/index.js");
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const requestTimeoutMs = Number(process.env.MCP_REQUEST_TIMEOUT_MS || 120000);
const bodyLimit = 32 * 1024 * 1024;

const child = spawn(process.execPath, [entry], {
  stdio: ["pipe", "pipe", "inherit"],
  env: process.env,
});

let buffer = Buffer.alloc(0);
let nextId = 1;
const pending = new Map();
let ready = false;

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function rpc(method, params, timeoutMs) {
  const id = nextId++;
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timed out waiting for ${method}`));
    }, timeoutMs);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolvePromise(message);
    });
    const payload = { jsonrpc: "2.0", id, method };
    if (params !== undefined) {
      payload.params = params;
    }
    send(payload);
  });
}

child.stdout.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const newline = buffer.indexOf(0x0a);
    if (newline < 0) {
      break;
    }
    const line = buffer.subarray(0, newline).toString("utf8").replace(/\r$/, "");
    buffer = buffer.subarray(newline + 1);
    if (!line.trim()) {
      continue;
    }
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      console.error(`ignored non-json stdout: ${line.slice(0, 160)}`);
      continue;
    }
    if (message.id === undefined || message.id === null || !pending.has(message.id)) {
      continue;
    }
    const done = pending.get(message.id);
    pending.delete(message.id);
    done(message);
  }
});

child.on("error", (error) => {
  console.error("failed to start MCP process:", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  console.error(`MCP process exited code=${code} signal=${signal ?? ""}`);
  ready = false;
  for (const [id, done] of pending) {
    pending.delete(id);
    done({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: "backend exited" },
    });
  }
  process.exit(code === null ? 1 : code);
});

const protocolVersions = ["2024-11-05", "2025-03-26", "2024-10-07"];

async function initialize() {
  let last;
  for (const protocolVersion of protocolVersions) {
    last = await rpc(
      "initialize",
      {
        protocolVersion,
        capabilities: {},
        clientInfo: { name: "omni-stdio-bridge", version: "1.0.0" },
      },
      20000,
    );
    if (!last.error) {
      break;
    }
    console.error(
      `initialize ${protocolVersion} rejected: ${last.error.message || "unknown"}`,
    );
  }
  if (!last || last.error) {
    throw new Error(last?.error?.message || "initialize failed");
  }
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  ready = true;
  const negotiated = last.result?.protocolVersion || "unknown";
  console.error(`stdio MCP ready (${negotiated})`);
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > bodyLimit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  const path = (req.url || "/").split("?")[0];
  if (req.method === "GET" && path === "/healthz") {
    sendJson(res, 200, { status: "ok" });
    return;
  }
  if (req.method === "GET" && path === "/readyz") {
    sendJson(res, ready ? 200 : 503, { status: ready ? "ready" : "starting" });
    return;
  }
  if (path === "/mcp" && (req.method === "GET" || req.method === "DELETE")) {
    res.writeHead(405, { Allow: "POST" });
    res.end();
    return;
  }
  if (req.method !== "POST" || path !== "/mcp") {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  if (!ready) {
    sendJson(res, 503, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: "backend not ready" },
    });
    return;
  }

  let incoming;
  try {
    incoming = JSON.parse((await readBody(req)) || "{}");
  } catch {
    sendJson(res, 400, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "parse error" },
    });
    return;
  }

  if (!incoming || typeof incoming.method !== "string") {
    sendJson(res, 400, {
      jsonrpc: "2.0",
      id: incoming?.id ?? null,
      error: { code: -32600, message: "missing method" },
    });
    return;
  }

  if (incoming.id === undefined || incoming.id === null) {
    res.writeHead(202);
    res.end();
    return;
  }

  if (incoming.method === "initialize") {
    sendJson(res, 200, {
      jsonrpc: "2.0",
      id: incoming.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "stdio-bridge", version: "1.0.0" },
      },
    });
    return;
  }

  try {
    const response = await rpc(incoming.method, incoming.params, requestTimeoutMs);
    response.id = incoming.id;
    sendJson(res, 200, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "bridge error";
    sendJson(res, 200, {
      jsonrpc: "2.0",
      id: incoming.id,
      error: { code: -32000, message },
    });
  }
});

server.listen(port, host, () => {
  console.error(`HTTP bridge on http://${host}:${port}/mcp -> ${entry}`);
});

initialize().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
