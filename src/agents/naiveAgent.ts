import type { Agent } from "../core/harness.js";
import type { AgentRunResult, ScenarioId } from "../core/types.js";
import { evaluateFreshness } from "../core/policy.js";
import {
  type PaidOracle,
  simulatePaymentHeader,
} from "../x402/localPaidOracle.js";
import { anchorResult } from "../casper/anchor.js";

export function createNaiveAgent(options: {
  oracle: PaidOracle;
  maxAgeMs: number;
  liveAnchor?: () => Promise<{ mode: "memory" | "casper-testnet"; txHash: string; note: string }>;
}): Agent {
  return {
    id: "naive",
    async run({ scenarioId, nowMs }) {
      const started = Date.now();
      const decisions: AgentRunResult["decisions"] = [];
      let paymentAttempts = 0;

      // 1) hit 402
      const challenge = await options.oracle.fetchQuote({ attempt: 1 });
      if (challenge.status !== 402) {
        return fail("payment_failed", "Expected 402 challenge", started, decisions, paymentAttempts);
      }

      // 2) pay and accept first payload blindly
      paymentAttempts += 1;
      const paid = await options.oracle.fetchQuote({
        attempt: 1,
        paymentHeader: simulatePaymentHeader(1),
      });

      if (paid.status !== 200 || !paid.quote) {
        return fail("payment_failed", "Paid request failed", started, decisions, paymentAttempts);
      }

      decisions.push({
        action: "execute",
        reason: "naive_accepts_first_paid_payload",
        quote: paid.quote,
        attempt: 1,
      });

      const freshness = evaluateFreshness(paid.quote, {
        nowMs,
        maxAgeMs: options.maxAgeMs,
      });

      // Naive agent does NOT check freshness — it executes anyway.
      const anchor = await anchorResult({
        scenarioId,
        agentId: "naive",
        passed: false,
        quote: paid.quote,
        live: options.liveAnchor,
      });

      const shouldFail =
        scenarioId === "stale-quote"
          ? !freshness.ok
          : scenarioId === "malformed-payload"
            ? !Number.isFinite(paid.quote.price) || !paid.quote.asOf
            : true;

      if (shouldFail) {
        return {
          agentId: "naive",
          passed: false,
          failureKind:
            scenarioId === "malformed-payload"
              ? "acted_on_malformed_data"
              : "acted_on_stale_data",
          decisions,
          paymentAttempts,
          recoveryPath: [],
          quoteUsed: paid.quote,
          txHash: anchor.txHash,
          error: `Executed despite ${freshness.reason}`,
          durationMs: Date.now() - started,
        };
      }

      return {
        agentId: "naive",
        passed: true,
        failureKind: "none",
        decisions,
        paymentAttempts,
        recoveryPath: [],
        quoteUsed: paid.quote,
        txHash: anchor.txHash,
        durationMs: Date.now() - started,
      };
    },
  };
}

function fail(
  failureKind: AgentRunResult["failureKind"],
  error: string,
  started: number,
  decisions: AgentRunResult["decisions"],
  paymentAttempts: number,
): AgentRunResult {
  return {
    agentId: "naive",
    passed: false,
    failureKind,
    decisions,
    paymentAttempts,
    recoveryPath: [],
    error,
    durationMs: Date.now() - started,
  };
}

export function describeNaivePolicy(): string {
  return "Pays once, trusts first payload, executes without freshness/integrity checks.";
}
