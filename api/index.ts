import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runScenario } from "../src/runScenario.js";
import type { ScenarioId } from "../src/core/types.js";
import { createLocalPaidOracle, simulatePaymentHeader } from "../src/x402/localPaidOracle.js";
import { proveCasperRpc } from "../src/casper/casperLive.js";

// Serverless entry for Vercel. Mirrors the local HTTP API surface.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const url = new URL(req.url ?? "/", `https://${req.headers.host}`);
    // Vercel may pass /api/...; also support rewritten /oracle
    const path = url.pathname.replace(/^\/api/, "") || url.pathname;

    if (req.method === "GET" && (path === "/health" || path === "/api/health" || url.pathname === "/api/health")) {
      return res.status(200).json({
        ok: true,
        product: "Temper",
        mode: process.env.TEMPER_MODE ?? "local",
        x402: "local-simulated",
        registry: process.env.CASPER_SECRET_KEY_PATH
          ? "casper-key-configured"
          : "memory",
      });
    }

    if (
      req.method === "GET" &&
      (path === "/casper/status" || url.pathname.endsWith("/casper/status"))
    ) {
      const status = await proveCasperRpc();
      return res.status(200).json({ ok: true, ...status });
    }

    if (
      req.method === "GET" &&
      (path === "/scenarios" || url.pathname.endsWith("/scenarios"))
    ) {
      return res.status(200).json({
        scenarios: [
          {
            id: "stale-quote",
            title: "Stale paid quote",
            description:
              "First x402-paid oracle response is stale. Naive fails; guarded retries.",
          },
          {
            id: "malformed-payload",
            title: "Malformed paid payload",
            description: "Paid oracle returns unusable data.",
          },
        ],
      });
    }

    if (
      req.method === "POST" &&
      (path === "/run" || url.pathname.endsWith("/run"))
    ) {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
      const scenarioId = (body.scenarioId ?? "stale-quote") as ScenarioId;
      const report = await runScenario(scenarioId, { live: Boolean(body.live) });
      return res.status(200).json(report);
    }

    if (
      req.method === "GET" &&
      (path.startsWith("/oracle/") || url.pathname.includes("/oracle/"))
    ) {
      const oracle = createLocalPaidOracle({
        mode: "stale-then-fresh",
        nowMs: Date.now(),
      });
      const payment =
        req.headers["payment-signature"] ?? req.headers["x-payment"];
      const attempt = Number(url.searchParams.get("attempt") ?? "1");
      const result = await oracle.fetchQuote({
        attempt,
        paymentHeader: payment ? String(payment) : undefined,
      });
      if (result.status === 402) {
        return res.status(402).json(result.paymentRequired);
      }
      return res.status(200).json(result);
    }

    if (
      req.method === "POST" &&
      (path === "/pay-demo" || url.pathname.endsWith("/pay-demo"))
    ) {
      const oracle = createLocalPaidOracle({
        mode: "stale-then-fresh",
        nowMs: Date.now(),
      });
      const challenge = await oracle.fetchQuote({ attempt: 1 });
      const paid = await oracle.fetchQuote({
        attempt: 1,
        paymentHeader: simulatePaymentHeader(1),
      });
      return res.status(200).json({ challenge, paid });
    }

    return res.status(404).json({ error: "not_found", path: url.pathname });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
