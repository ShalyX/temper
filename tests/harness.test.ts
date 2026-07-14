import { describe, expect, it } from "vitest";
import { runDualScenario } from "../src/core/harness.js";
import { createLocalPaidOracle } from "../src/x402/localPaidOracle.js";
import { createNaiveAgent } from "../src/agents/naiveAgent.js";
import { createGuardedAgent } from "../src/agents/guardedAgent.js";
import { createMemoryRegistry } from "../src/casper/memoryRegistry.js";

describe("runDualScenario stale-quote", () => {
  it("fails naive agent and passes guarded agent", async () => {
    const nowMs = Date.parse("2026-07-14T12:00:00.000Z");
    // Separate oracles so each agent gets its own stale-then-fresh sequence.
    const naiveOracle = createLocalPaidOracle({
      mode: "stale-then-fresh",
      nowMs,
    });
    const guardedOracle = createLocalPaidOracle({
      mode: "stale-then-fresh",
      nowMs,
    });
    const registry = createMemoryRegistry();
    const report = await runDualScenario({
      scenarioId: "stale-quote",
      naiveAgent: createNaiveAgent({ oracle: naiveOracle, maxAgeMs: 60_000 }),
      guardedAgent: createGuardedAgent({
        oracle: guardedOracle,
        maxAgeMs: 60_000,
        maxRetries: 1,
      }),
      registry,
      nowMs: Date.parse("2026-07-14T12:00:00.000Z"),
    });

    expect(report.scenarioId).toBe("stale-quote");
    expect(report.naive.passed).toBe(false);
    expect(report.naive.failureKind).toBe("acted_on_stale_data");
    expect(report.guarded.passed).toBe(true);
    expect(report.guarded.txHash).toBeTruthy();
    expect(report.guarded.recoveryPath.some((step) => step.includes("retry"))).toBe(
      true,
    );
    expect(report.comparison.delta).toBe("guarded_recovered_naive_failed");
    expect(report.registryEntries).toHaveLength(2);
  });
});
