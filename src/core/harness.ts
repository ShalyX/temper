import { createHash, randomUUID } from "node:crypto";
import type {
  AgentRunResult,
  DualRunReport,
  RegistryEntry,
  ScenarioId,
} from "./types.js";

export type Registry = {
  record(entry: Omit<RegistryEntry, "id" | "createdAt">): Promise<RegistryEntry>;
  list(): Promise<RegistryEntry[]>;
};

export type Agent = {
  id: "naive" | "guarded";
  run(input: {
    scenarioId: ScenarioId;
    nowMs: number;
  }): Promise<AgentRunResult>;
};

export type DualScenarioInput = {
  scenarioId: ScenarioId;
  naiveAgent: Agent;
  guardedAgent: Agent;
  registry: Registry;
  nowMs?: number;
  mode?: DualRunReport["mode"];
};

function summarize(naive: AgentRunResult, guarded: AgentRunResult) {
  if (!naive.passed && guarded.passed) {
    return {
      delta: "guarded_recovered_naive_failed",
      summary:
        "Naive agent executed on bad data. Guarded agent detected the fault, recovered, and completed a safe transaction path.",
    };
  }
  if (naive.passed && guarded.passed) {
    return {
      delta: "both_passed",
      summary: "Both agents passed the scenario.",
    };
  }
  if (!naive.passed && !guarded.passed) {
    return {
      delta: "both_failed",
      summary: "Both agents failed the scenario.",
    };
  }
  return {
    delta: "naive_passed_guarded_failed",
    summary: "Unexpected inversion: naive passed while guarded failed.",
  };
}

export function hashTrace(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export async function runDualScenario(
  input: DualScenarioInput,
): Promise<DualRunReport> {
  const nowMs = input.nowMs ?? Date.now();
  const startedAt = new Date(nowMs).toISOString();

  const naive = await input.naiveAgent.run({
    scenarioId: input.scenarioId,
    nowMs,
  });
  const guarded = await input.guardedAgent.run({
    scenarioId: input.scenarioId,
    nowMs,
  });

  const registryEntries: RegistryEntry[] = [];
  const registryMode = input.mode?.registry ?? "memory";
  for (const result of [naive, guarded]) {
    const entry = await input.registry.record({
      scenarioId: input.scenarioId,
      agentId: result.agentId,
      passed: result.passed,
      failureKind: result.failureKind,
      traceHash: hashTrace(result),
      txHash: result.txHash,
      mode: registryMode,
      deployHash: result.txHash,
    });
    registryEntries.push(entry);
  }

  const finishedAt = new Date(Date.now()).toISOString();
  return {
    scenarioId: input.scenarioId,
    startedAt,
    finishedAt,
    naive,
    guarded,
    comparison: summarize(naive, guarded),
    registryEntries,
    mode: input.mode ?? {
      x402: "local-simulated",
      registry: "memory",
    },
  };
}

export function newRunId(): string {
  return randomUUID();
}
