import type { Agent } from "../core/harness.js";
import type { AgentRunResult } from "../core/types.js";
import { evaluateFreshness } from "../core/policy.js";
import {
  type PaidOracle,
  simulatePaymentHeader,
} from "../x402/localPaidOracle.js";
import { anchorResult } from "../casper/anchor.js";

export function createGuardedAgent(options: {
  oracle: PaidOracle;
  maxAgeMs: number;
  maxRetries: number;
  liveAnchor?: () => Promise<{ mode: "memory" | "casper-testnet"; txHash: string; note: string }>;
}): Agent {
  return {
    id: "guarded",
    async run({ scenarioId, nowMs }) {
      const started = Date.now();
      const decisions: AgentRunResult["decisions"] = [];
      const recoveryPath: string[] = [];
      let paymentAttempts = 0;

      const challenge = await options.oracle.fetchQuote({ attempt: 1 });
      if (challenge.status !== 402) {
        return fail("payment_failed", "Expected 402 challenge", started, decisions, recoveryPath, paymentAttempts);
      }

      for (let attempt = 1; attempt <= options.maxRetries + 1; attempt++) {
        paymentAttempts += 1;
        const paid = await options.oracle.fetchQuote({
          attempt,
          paymentHeader: simulatePaymentHeader(attempt),
        });

        if (paid.status !== 200 || !paid.quote) {
          decisions.push({
            action: "abort",
            reason: "paid_request_failed",
            attempt,
          });
          return fail(
            "payment_failed",
            "Paid request failed",
            started,
            decisions,
            recoveryPath,
            paymentAttempts,
          );
        }

        const quote = paid.quote;
        if (!Number.isFinite(quote.price) || !quote.asOf) {
          decisions.push({
            action: "abort",
            reason: "malformed_payload",
            quote,
            attempt,
          });
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

        const freshness = evaluateFreshness(quote, {
          nowMs,
          maxAgeMs: options.maxAgeMs,
        });

        if (!freshness.ok) {
          decisions.push({
            action: "retry",
            reason: `policy_block:${freshness.reason}`,
            quote,
            attempt,
          });
          recoveryPath.push(`retry_after_${freshness.reason}`);
          if (attempt <= options.maxRetries) {
            continue;
          }
          return {
            agentId: "guarded",
            passed: false,
            failureKind: "policy_block",
            decisions,
            paymentAttempts,
            recoveryPath,
            quoteUsed: quote,
            error: `Exhausted retries; last reason ${freshness.reason}`,
            durationMs: Date.now() - started,
          };
        }

        decisions.push({
          action: "execute",
          reason: "fresh_quote_accepted",
          quote,
          attempt,
        });
        recoveryPath.push("execute_on_fresh_quote");

        const anchor = await anchorResult({
          scenarioId,
          agentId: "guarded",
          passed: true,
          quote,
          live: options.liveAnchor,
        });

        return {
          agentId: "guarded",
          passed: true,
          failureKind: "none",
          decisions,
          paymentAttempts,
          recoveryPath,
          quoteUsed: quote,
          txHash: anchor.txHash,
          durationMs: Date.now() - started,
        };
      }

      return fail(
        "policy_block",
        "No attempts completed",
        started,
        decisions,
        recoveryPath,
        paymentAttempts,
      );
    },
  };
}

function fail(
  failureKind: AgentRunResult["failureKind"],
  error: string,
  started: number,
  decisions: AgentRunResult["decisions"],
  recoveryPath: string[],
  paymentAttempts: number,
): AgentRunResult {
  return {
    agentId: "guarded",
    passed: false,
    failureKind,
    decisions,
    paymentAttempts,
    recoveryPath,
    error,
    durationMs: Date.now() - started,
  };
}

export function describeGuardedPolicy(): string {
  return "Pays, verifies freshness/integrity, retries once on stale data, only executes on fresh quotes.";
}
