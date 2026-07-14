import {
  runScenario,
  saveReport,
  SCENARIOS,
  runLiveTransferOnce,
} from "./runScenario.js";
import type { ScenarioId } from "./core/types.js";
import {
  getPublicKeyHexFromConfig,
  loadCasperConfigFromEnv,
  proveCasperRpc,
} from "./casper/casperLive.js";

function printHelp() {
  console.log(`Temper — reliability harness for Casper agents

Usage:
  npm run temper -- run <scenario> [--dual] [--live] [--json]
  npm run temper -- transfer
  npm run temper -- status
  npm run temper -- list
  npm run temper -- help

Scenarios:
  stale-quote         First paid oracle response is stale; guarded agent retries
  malformed-payload   Paid oracle returns unusable payload
  expired-quote       Alias of stale-quote with expired timestamps

Flags:
  --dual              Run naive vs guarded comparison (default)
  --live              Anchor each agent result with a real Casper Testnet transfer
  --json              Print machine-readable report

Env for --live / transfer:
  CASPER_SECRET_KEY_PATH   path to funded Testnet PEM
  CASPER_RPC_URL           default https://node.testnet.casper.network/rpc
  CASPER_NETWORK_NAME      default casper-test
`);
}

function resolveScenario(name: string): ScenarioId {
  if (name === "expired-quote") return "stale-quote";
  if (!SCENARIOS.includes(name as ScenarioId) && name !== "expired-quote") {
    throw new Error(`Unknown scenario: ${name}`);
  }
  return name as ScenarioId;
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] ?? "help";

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }

  if (cmd === "list") {
    console.log(SCENARIOS.join("\n"));
    return;
  }

  if (cmd === "status") {
    const rpc = await proveCasperRpc();
    const config = loadCasperConfigFromEnv();
    const out: Record<string, unknown> = {
      rpc,
      keyConfigured: Boolean(config),
    };
    if (config) {
      out.publicKeyHex = await getPublicKeyHexFromConfig(config);
      out.secretKeyPath = config.secretKeyPath;
      out.networkName = config.networkName;
    }
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (cmd === "transfer") {
    const out = await runLiveTransferOnce();
    console.log(JSON.stringify(out, null, 2));
    console.log(
      `\nExplorer: https://testnet.cspr.live/transaction/${out.result.txHash}`,
    );
    return;
  }

  if (cmd === "run") {
    const scenarioName = args[1];
    if (!scenarioName) {
      console.error(
        "Missing scenario. Try: npm run temper -- run stale-quote --dual",
      );
      process.exit(1);
    }
    const asJson = args.includes("--json");
    const live = args.includes("--live");
    const scenarioId = resolveScenario(scenarioName);
    const report = await runScenario(scenarioId, { live });
    const path = saveReport(report);

    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`\nTemper dual-run: ${report.scenarioId}`);
      console.log(
        `Mode: x402=${report.mode.x402} registry=${report.mode.registry}`,
      );
      console.log(
        `\nNaive  : ${report.naive.passed ? "PASS" : "FAIL"} (${report.naive.failureKind})`,
      );
      console.log(
        `Guarded: ${report.guarded.passed ? "PASS" : "FAIL"} (${report.guarded.failureKind})`,
      );
      console.log(`Delta  : ${report.comparison.delta}`);
      console.log(`Summary: ${report.comparison.summary}`);
      if (report.guarded.recoveryPath.length) {
        console.log(`Recovery: ${report.guarded.recoveryPath.join(" → ")}`);
      }
      if (report.naive.txHash) console.log(`Naive tx:   ${report.naive.txHash}`);
      if (report.guarded.txHash)
        console.log(`Guarded tx: ${report.guarded.txHash}`);
      console.log(`\nSaved: ${path}`);
    }

    const ok = !report.naive.passed && report.guarded.passed;
    process.exit(ok ? 0 : 2);
  }

  console.error(`Unknown command: ${cmd}`);
  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
