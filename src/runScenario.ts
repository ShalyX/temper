import { runDualScenario } from "./core/harness.js";
import { createNaiveAgent } from "./agents/naiveAgent.js";
import { createGuardedAgent } from "./agents/guardedAgent.js";
import { createLocalPaidOracle } from "./x402/localPaidOracle.js";
import { createMemoryRegistry } from "./casper/memoryRegistry.js";
import type { DualRunReport, ScenarioId } from "./core/types.js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  createLiveCasperAnchor,
  loadCasperConfigFromEnv,
  submitLiveTransfer,
  getPublicKeyHexFromConfig,
  proveCasperRpc,
} from "./casper/casperLive.js";

export async function runScenario(
  scenarioId: ScenarioId,
  options: { live?: boolean } = {},
): Promise<DualRunReport> {
  const nowMs = Date.now();
  const oracleMode =
    scenarioId === "malformed-payload" ? "malformed" : "stale-then-fresh";

  const naiveOracle = createLocalPaidOracle({ mode: oracleMode, nowMs });
  const guardedOracle = createLocalPaidOracle({ mode: oracleMode, nowMs });
  const registry = createMemoryRegistry();

  let liveAnchor: (() => Promise<{ mode: "memory" | "casper-testnet"; txHash: string; note: string }>) | undefined;
  let registryMode: "memory" | "casper-testnet" = "memory";

  if (options.live) {
    const config = loadCasperConfigFromEnv();
    if (!config) {
      throw new Error(
        "Live mode requires CASPER_SECRET_KEY_PATH pointing to a funded Testnet PEM",
      );
    }
    liveAnchor = await createLiveCasperAnchor(config);
    registryMode = "casper-testnet";
  }

  return runDualScenario({
    scenarioId,
    naiveAgent: createNaiveAgent({
      oracle: naiveOracle,
      maxAgeMs: 60_000,
      liveAnchor,
    }),
    guardedAgent: createGuardedAgent({
      oracle: guardedOracle,
      maxAgeMs: 60_000,
      maxRetries: 1,
      liveAnchor,
    }),
    registry,
    nowMs,
    mode: {
      x402: "local-simulated",
      registry: registryMode,
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

export async function runLiveTransferOnce() {
  const config = loadCasperConfigFromEnv();
  if (!config) {
    throw new Error("CASPER_SECRET_KEY_PATH is not set");
  }
  const pub = await getPublicKeyHexFromConfig(config);
  const rpc = await proveCasperRpc(config.rpcUrl);
  const result = await submitLiveTransfer(config);
  return { publicKeyHex: pub, rpc, result };
}
