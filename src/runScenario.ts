import { runDualScenario } from "./core/harness.js";
import { createNaiveAgent } from "./agents/naiveAgent.js";
import { createGuardedAgent } from "./agents/guardedAgent.js";
import { createLocalPaidOracle } from "./x402/localPaidOracle.js";
import { createMemoryRegistry } from "./casper/memoryRegistry.js";
import type { DualRunReport, ScenarioId } from "./core/types.js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export async function runScenario(scenarioId: ScenarioId): Promise<DualRunReport> {
  const nowMs = Date.now();
  const oracleMode =
    scenarioId === "malformed-payload" ? "malformed" : "stale-then-fresh";

  // Independent oracles: each agent must observe the full fault sequence.
  const naiveOracle = createLocalPaidOracle({ mode: oracleMode, nowMs });
  const guardedOracle = createLocalPaidOracle({ mode: oracleMode, nowMs });
  const registry = createMemoryRegistry();

  return runDualScenario({
    scenarioId,
    naiveAgent: createNaiveAgent({ oracle: naiveOracle, maxAgeMs: 60_000 }),
    guardedAgent: createGuardedAgent({
      oracle: guardedOracle,
      maxAgeMs: 60_000,
      maxRetries: 1,
    }),
    registry,
    nowMs,
    mode: {
      x402: "local-simulated",
      registry: "memory",
    },
  });
}

export function saveReport(report: DualRunReport) {
  const dir = join(process.cwd(), "runs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = join(dir, `${report.scenarioId}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

export const SCENARIOS: ScenarioId[] = [
  "stale-quote",
  "malformed-payload",
  "expired-quote",
];
