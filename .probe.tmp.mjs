import fs0 from "node:fs"; fs0.appendFileSync(process.env.L, "start\n");
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const t0 = Date.now();
import fs from "node:fs";
const log = (...a) => fs.appendFileSync(process.env.L, [String(Date.now() - t0).padStart(6), ...a].join(" ") + "\n");
const f = async (url, init) => {
  log(">", init?.method ?? "GET", String(init?.body ?? "").slice(0, 80));
  try { const r = await fetch(url, init); log("<", r.status, r.headers.get("content-type")); return r; } catch (e) { log("x", e.message); throw e; }
};
const c = new Client({ name: "probe", version: "1" });
await c.connect(new StreamableHTTPClientTransport(new URL("https://idstudio-test.lanternbay.net/api/mcp"), { fetch: f, requestInit: { headers: { Authorization: `Bearer ${process.argv[2]}` } } }));
log("connected");
log("tools", (await c.listTools()).tools.length);
process.exit(0);
