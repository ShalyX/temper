import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { runScenario } from "../runScenario.js";
import type { ScenarioId } from "../core/types.js";
import { createLocalPaidOracle, simulatePaymentHeader } from "../x402/localPaidOracle.js";

const PORT = Number(process.env.PORT ?? 4173);
const PUBLIC_DIR = join(process.cwd(), "public");

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function send(res: http.ServerResponse, status: number, body: unknown, type = "application/json") {
  const payload = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": type,
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(payload);
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  let pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = join(PUBLIC_DIR, pathname.replace(/^\/+/, ""));
  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) return false;
  const data = readFileSync(filePath);
  res.writeHead(200, { "content-type": mime[extname(filePath)] ?? "application/octet-stream" });
  res.end(data);
  return true;
}

async function readJson(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const oracle = createLocalPaidOracle({
  mode: "stale-then-fresh",
  nowMs: Date.now(),
});

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      return send(res, 204, "");
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      return send(res, 200, {
        ok: true,
        product: "Temper",
        mode: process.env.TEMPER_MODE ?? "local",
        x402: "local-simulated",
        registry: process.env.CASPER_SECRET_KEY_PATH ? "casper-key-configured" : "memory",
      });
    }

    if (req.method === "GET" && url.pathname === "/api/casper/status") {
      const { proveCasperRpc } = await import("../casper/casperLive.js");
      const status = await proveCasperRpc();
      return send(res, 200, { ok: true, ...status });
    }

    if (req.method === "GET" && url.pathname === "/api/scenarios") {
      return send(res, 200, {
        scenarios: [
          {
            id: "stale-quote",
            title: "Stale paid quote",
            description:
              "First x402-paid oracle response is stale. Naive agent executes anyway. Guarded agent retries and only executes on a fresh quote.",
          },
          {
            id: "malformed-payload",
            title: "Malformed paid payload",
            description:
              "Paid oracle returns unusable data. Guarded agent rejects; naive agent would still act.",
          },
        ],
      });
    }

    // x402-shaped paid oracle endpoint for inspection / agent adapters
    if (req.method === "GET" && url.pathname === "/oracle/cspr-usd") {
      const payment = req.headers["payment-signature"] ?? req.headers["x-payment"];
      const attempt = Number(url.searchParams.get("attempt") ?? "1");
      const result = await oracle.fetchQuote({
        attempt,
        paymentHeader: payment ? String(payment) : undefined,
      });
      if (result.status === 402) {
        res.writeHead(402, {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        });
        res.end(JSON.stringify(result.paymentRequired, null, 2));
        return;
      }
      return send(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/run") {
      const body = await readJson(req);
      const scenarioId = (body.scenarioId ?? "stale-quote") as ScenarioId;
      // Rebuild oracle with fixed now for determinism if provided
      const report = await runScenario(scenarioId);
      return send(res, 200, report);
    }

    if (req.method === "POST" && url.pathname === "/api/pay-demo") {
      // helper for UI to show 402 → pay → response without full agent loop
      const attempt = 1;
      const challenge = await oracle.fetchQuote({ attempt });
      const paid = await oracle.fetchQuote({
        attempt,
        paymentHeader: simulatePaymentHeader(attempt),
      });
      return send(res, 200, { challenge, paid });
    }

    if (serveStatic(req, res)) return;

    send(res, 404, { error: "not_found" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send(res, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Temper listening on http://127.0.0.1:${PORT}`);
  console.log(`UI:      http://127.0.0.1:${PORT}/`);
  console.log(`Health:  http://127.0.0.1:${PORT}/api/health`);
});
