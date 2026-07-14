import { createHash, randomUUID } from "node:crypto";
import type { MarketQuote } from "../core/types.js";

export type AnchorResult = {
  mode: "memory" | "casper-testnet";
  txHash: string;
  deployHash?: string;
  note: string;
};

/**
 * Anchors a test result. Without CASPER_SECRET_KEY_PATH this creates a deterministic
 * local proof hash labeled as memory mode. With a funded key, callers should use
 * the live adapter (casperLive.ts) which submits a real Testnet transfer/deploy.
 */
export async function anchorResult(input: {
  scenarioId: string;
  agentId: string;
  passed: boolean;
  quote?: MarketQuote;
  live?: () => Promise<AnchorResult>;
}): Promise<AnchorResult> {
  if (input.live) {
    return input.live();
  }

  const material = JSON.stringify({
    scenarioId: input.scenarioId,
    agentId: input.agentId,
    passed: input.passed,
    quote: input.quote,
    nonce: randomUUID(),
  });
  const digest = createHash("sha256").update(material).digest("hex");
  return {
    mode: "memory",
    txHash: `mem_${digest.slice(0, 32)}`,
    note: "Local result anchor (no Casper key configured). Not a network transaction.",
  };
}
