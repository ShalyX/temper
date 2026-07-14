export type ScenarioId = "stale-quote" | "malformed-payload" | "expired-quote";

export type FailureKind =
  | "acted_on_stale_data"
  | "acted_on_malformed_data"
  | "acted_on_expired_quote"
  | "policy_block"
  | "payment_failed"
  | "tx_failed"
  | "none";

export type MarketQuote = {
  symbol: string;
  price: number;
  asOf: string;
  source: string;
  expiresAt?: string;
};

export type FreshnessResult = {
  ok: boolean;
  reason: "fresh" | "stale" | "missing_as_of" | "invalid_as_of" | "expired";
  ageMs?: number;
};

export type AgentDecision = {
  action: "execute" | "abort" | "retry";
  reason: string;
  quote?: MarketQuote;
  attempt: number;
};

export type AgentRunResult = {
  agentId: "naive" | "guarded";
  passed: boolean;
  failureKind: FailureKind;
  decisions: AgentDecision[];
  paymentAttempts: number;
  recoveryPath: string[];
  quoteUsed?: MarketQuote;
  txHash?: string;
  error?: string;
  durationMs: number;
};

export type RegistryEntry = {
  id: string;
  scenarioId: ScenarioId;
  agentId: "naive" | "guarded";
  passed: boolean;
  failureKind: FailureKind;
  traceHash: string;
  txHash?: string;
  createdAt: string;
  mode: "memory" | "casper-testnet";
  deployHash?: string;
};

export type DualRunReport = {
  scenarioId: ScenarioId;
  startedAt: string;
  finishedAt: string;
  naive: AgentRunResult;
  guarded: AgentRunResult;
  comparison: {
    delta: string;
    summary: string;
  };
  registryEntries: RegistryEntry[];
  mode: {
    x402: "local-simulated" | "live";
    registry: "memory" | "casper-testnet";
  };
};
