import { runScenario, saveReport, SCENARIOS } from "./runScenario.js";
import type { ScenarioId } from "./core/types.js";

function printHelp() {
  console.log(`Temper — reliability harness for Casper agents

Usage:
  npm run temper -- run <scenario> [--dual]
  npm run temper -- list
  npm run temper -- help

Scenarios:
  stale-quote         First paid oracle response is stale; guarded agent retries
  malformed-payload   Paid oracle returns unusable payload
  expired-quote       Alias of stale-quote with expired timestamps

Flags:
  --dual              Run naive vs guarded comparison (default)
  --json              Print machine-readable report
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

  if (cmd === "run") {
    const scenarioName = args[1];
    if (!scenarioName) {
      console.error("Missing scenario. Try: npm run temper -- run stale-quote --dual");
      process.exit(1);
    }
    const asJson = args.includes("--json");
    const scenarioId = resolveScenario(scenarioName);
    const report = await runScenario(scenarioId);
    const path = saveReport(report);

    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`\nTemper dual-run: ${report.scenarioId}`);
      console.log(`Mode: x402=${report.mode.x402} registry=${report.mode.registry}`);
      console.log(`\nNaive  : ${report.naive.passed ? "PASS" : "FAIL"} (${report.naive.failureKind})`);
      console.log(`Guarded: ${report.guarded.passed ? "PASS" : "FAIL"} (${report.guarded.failureKind})`);
      console.log(`Delta  : ${report.comparison.delta}`);
      console.log(`Summary: ${report.comparison.summary}`);
      if (report.guarded.recoveryPath.length) {
        console.log(`Recovery: ${report.guarded.recoveryPath.join(" → ")}`);
      }
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
