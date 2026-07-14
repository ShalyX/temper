// Vercel serverless API — pure CommonJS-compatible ESM with inlined minimal dual-run.
// Keeps production deploy independent of tsc output.

import { createHash, randomUUID } from "node:crypto";

function evaluateFreshness(quote, { nowMs, maxAgeMs }) {
  if (!quote?.asOf) return { ok: false, reason: "missing_as_of" };
  const asOfMs = Date.parse(quote.asOf);
  if (Number.isNaN(asOfMs)) return { ok: false, reason: "invalid_as_of" };
  if (quote.expiresAt) {
    const expiresMs = Date.parse(quote.expiresAt);
    if (!Number.isNaN(expiresMs) && nowMs > expiresMs) {
      return { ok: false, reason: "expired", ageMs: nowMs - asOfMs };
    }
  }
  const ageMs = nowMs - asOfMs;
  if (ageMs > maxAgeMs) return { ok: false, reason: "stale", ageMs };
  return { ok: true, reason: "fresh", ageMs };
}

function createOracle(mode, nowMs) {
  let paidCalls = 0;
  return {
    async fetchQuote({ paymentHeader, attempt }) {
      if (!paymentHeader) {
        return {
          status: 402,
          paymentRequired: {
            scheme: "exact",
            network: "local-sim",
            maxAmountRequired: "0.01",
            asset: "sim-WCSPR",
            payTo: "local-payee",
            resource: "/oracle/cspr-usd",
            description: "Paid CSPR/USD quote for Temper agent scenarios",
          },
        };
      }
      paidCalls += 1;
      const authorizationId = `local-auth-${paidCalls}-${attempt}`;
      if (mode === "malformed") {
        return {
          status: 200,
          paymentReceipt: { mode: "local-simulated", authorizationId, settled: true },
          quote: { symbol: "CSPR-USD", price: Number.NaN, asOf: "", source: "paid-oracle" },
        };
      }
      if (paidCalls === 1 && mode === "stale-then-fresh") {
        return {
          status: 200,
          paymentReceipt: { mode: "local-simulated", authorizationId, settled: true },
          quote: {
            symbol: "CSPR-USD",
            price: 0.0399,
            asOf: new Date(nowMs - 10 * 60_000).toISOString(),
            source: "paid-oracle",
            expiresAt: new Date(nowMs - 30_000).toISOString(),
          },
        };
      }
      return {
        status: 200,
        paymentReceipt: { mode: "local-simulated", authorizationId, settled: true },
        quote: {
          symbol: "CSPR-USD",
          price: 0.0423,
          asOf: new Date(nowMs - 3_000).toISOString(),
          source: "paid-oracle",
          expiresAt: new Date(nowMs + 5 * 60_000).toISOString(),
        },
      };
    },
  };
}

function payHeader(attempt) {
  return `TEMPER-LOCAL-PAYMENT attempt=${attempt} ts=${Date.now()}`;
}

function memAnchor(label) {
  const digest = createHash("sha256").update(`${label}:${randomUUID()}`).digest("hex");
  return `mem_${digest.slice(0, 32)}`;
}

async function runNaive(oracle, nowMs, scenarioId) {
  const started = Date.now();
  const decisions = [];
  await oracle.fetchQuote({ attempt: 1 });
  const paid = await oracle.fetchQuote({ attempt: 1, paymentHeader: payHeader(1) });
  decisions.push({
    action: "execute",
    reason: "naive_accepts_first_paid_payload",
    quote: paid.quote,
    attempt: 1,
  });
  const freshness = evaluateFreshness(paid.quote, { nowMs, maxAgeMs: 60_000 });
  const shouldFail =
    scenarioId === "malformed-payload"
      ? !Number.isFinite(paid.quote.price) || !paid.quote.asOf
      : !freshness.ok;
  return {
    agentId: "naive",
    passed: !shouldFail,
    failureKind: shouldFail
      ? scenarioId === "malformed-payload"
        ? "acted_on_malformed_data"
        : "acted_on_stale_data"
      : "none",
    decisions,
    paymentAttempts: 1,
    recoveryPath: [],
    quoteUsed: paid.quote,
    txHash: memAnchor("naive"),
    error: shouldFail ? `Executed despite ${freshness.reason}` : undefined,
    durationMs: Date.now() - started,
  };
}

async function runGuarded(oracle, nowMs, scenarioId) {
  const started = Date.now();
  const decisions = [];
  const recoveryPath = [];
  let paymentAttempts = 0;
  await oracle.fetchQuote({ attempt: 1 });
  for (let attempt = 1; attempt <= 2; attempt++) {
    paymentAttempts += 1;
    const paid = await oracle.fetchQuote({
      attempt,
      paymentHeader: payHeader(attempt),
    });
    const quote = paid.quote;
    if (!Number.isFinite(quote.price) || !quote.asOf) {
      decisions.push({ action: "abort", reason: "malformed_payload", quote, attempt });
      recoveryPath.push("reject_malformed");
      return {
        agentId: "guarded",
        passed: false,
        failureKind: "acted_on_malformed_data",
        decisions,
        paymentAttempts,
        recoveryPath,
        quoteUsed: quote,
        error: "Rejected malformed quote",
        durationMs: Date.now() - started,
      };
    }
    const freshness = evaluateFreshness(quote, { nowMs, maxAgeMs: 60_000 });
    if (!freshness.ok) {
      decisions.push({
        action: "retry",
        reason: `policy_block:${freshness.reason}`,
        quote,
        attempt,
      });
      recoveryPath.push(`retry_after_${freshness.reason}`);
      continue;
    }
    decisions.push({ action: "execute", reason: "fresh_quote_accepted", quote, attempt });
    recoveryPath.push("execute_on_fresh_quote");
    return {
      agentId: "guarded",
      passed: true,
      failureKind: "none",
      decisions,
      paymentAttempts,
      recoveryPath,
      quoteUsed: quote,
      txHash: memAnchor("guarded"),
      durationMs: Date.now() - started,
    };
  }
  return {
    agentId: "guarded",
    passed: false,
    failureKind: "policy_block",
    decisions,
    paymentAttempts,
    recoveryPath,
    error: "Exhausted retries",
    durationMs: Date.now() - started,
  };
}

async function runDual(scenarioId) {
  const nowMs = Date.now();
  const mode = scenarioId === "malformed-payload" ? "malformed" : "stale-then-fresh";
  const naiveOracle = createOracle(mode, nowMs);
  const guardedOracle = createOracle(mode, nowMs);
  const naive = await runNaive(naiveOracle, nowMs, scenarioId);
  const guarded = await runGuarded(guardedOracle, nowMs, scenarioId);
  return {
    scenarioId,
    startedAt: new Date(nowMs).toISOString(),
    finishedAt: new Date().toISOString(),
    naive,
    guarded,
    comparison: {
      delta:
        !naive.passed && guarded.passed
          ? "guarded_recovered_naive_failed"
          : "other",
      summary:
        !naive.passed && guarded.passed
          ? "Naive agent executed on bad data. Guarded agent detected the fault, recovered, and completed a safe transaction path."
          : "See agent results",
    },
    registryEntries: [
      {
        id: randomUUID(),
        scenarioId,
        agentId: "naive",
        passed: naive.passed,
        failureKind: naive.failureKind,
        traceHash: createHash("sha256").update(JSON.stringify(naive)).digest("hex"),
        txHash: naive.txHash,
        createdAt: new Date().toISOString(),
        mode: "memory",
      },
      {
        id: randomUUID(),
        scenarioId,
        agentId: "guarded",
        passed: guarded.passed,
        failureKind: guarded.failureKind,
        traceHash: createHash("sha256").update(JSON.stringify(guarded)).digest("hex"),
        txHash: guarded.txHash,
        createdAt: new Date().toISOString(),
        mode: "memory",
      },
    ],
    mode: { x402: "local-simulated", registry: "memory" },
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `https://${host}`);
    const path = url.pathname;

    if (req.method === "GET" && (path === "/api/health" || path.endsWith("/health"))) {
      return res.status(200).json({
        ok: true,
        product: "Temper",
        mode: "local",
        x402: "local-simulated",
        registry: "memory",
        host: "vercel",
      });
    }

    if (req.method === "GET" && path.includes("/casper/status")) {
      // Lightweight RPC probe without bundling full SDK on cold start failures
      const r = await fetch("https://node.testnet.casper.network/rpc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "info_get_status",
          params: [],
        }),
      });
      const data = await r.json();
      return res.status(200).json({
        ok: true,
        chainSpecName: data.result?.chainspec_name || data.result?.chain_spec_name,
        protocolVersion: data.result?.protocol_version,
      });
    }

    if (req.method === "GET" && path.includes("/scenarios")) {
      return res.status(200).json({
        scenarios: [
          { id: "stale-quote", title: "Stale paid quote" },
          { id: "malformed-payload", title: "Malformed paid payload" },
        ],
      });
    }

    if (req.method === "POST" && path.includes("/run")) {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const scenarioId = body.scenarioId || "stale-quote";
      const report = await runDual(scenarioId);
      return res.status(200).json(report);
    }

    if (req.method === "GET" && path.includes("/oracle/")) {
      const oracle = createOracle("stale-then-fresh", Date.now());
      const payment = req.headers["payment-signature"] || req.headers["x-payment"];
      const attempt = Number(url.searchParams.get("attempt") || "1");
      const result = await oracle.fetchQuote({
        attempt,
        paymentHeader: payment ? String(payment) : undefined,
      });
      if (result.status === 402) return res.status(402).json(result.paymentRequired);
      return res.status(200).json(result);
    }

    return res.status(404).json({ error: "not_found", path });
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
