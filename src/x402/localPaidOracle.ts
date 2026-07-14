import type { MarketQuote } from "../core/types.js";

export type PaidOracleResponse = {
  status: 200 | 402;
  paymentRequired?: {
    scheme: "exact";
    network: "casper:casper-test" | "local-sim";
    maxAmountRequired: string;
    asset: string;
    payTo: string;
    resource: string;
    description: string;
  };
  paymentReceipt?: {
    mode: "local-simulated" | "live";
    authorizationId: string;
    settled: boolean;
  };
  quote?: MarketQuote;
  error?: string;
};

export type PaidOracle = {
  fetchQuote(input: {
    paymentHeader?: string;
    attempt: number;
  }): Promise<PaidOracleResponse>;
};

export type LocalPaidOracleOptions = {
  mode: "stale-then-fresh" | "always-fresh" | "always-stale" | "malformed";
  nowMs: number;
  payTo?: string;
  price?: string;
};

/**
 * Local paid-oracle that implements the x402 challenge/response shape for demos.
 * Mode labels are honest: responses are local-simulated unless a live facilitator is wired.
 */
export function createLocalPaidOracle(options: LocalPaidOracleOptions): PaidOracle {
  let paidCalls = 0;

  return {
    async fetchQuote({ paymentHeader, attempt }) {
      if (!paymentHeader) {
        return {
          status: 402,
          paymentRequired: {
            scheme: "exact",
            network: "local-sim",
            maxAmountRequired: options.price ?? "0.01",
            asset: "sim-WCSPR",
            payTo: options.payTo ?? "local-payee",
            resource: "/oracle/cspr-usd",
            description: "Paid CSPR/USD quote for Temper agent scenarios",
          },
        };
      }

      paidCalls += 1;
      const authorizationId = `local-auth-${paidCalls}-${attempt}`;

      if (options.mode === "malformed") {
        return {
          status: 200,
          paymentReceipt: {
            mode: "local-simulated",
            authorizationId,
            settled: true,
          },
          // deliberately broken payload
          quote: {
            symbol: "CSPR-USD",
            price: Number.NaN,
            asOf: "",
            source: "paid-oracle",
          },
        };
      }

      if (options.mode === "always-stale") {
        return {
          status: 200,
          paymentReceipt: {
            mode: "local-simulated",
            authorizationId,
            settled: true,
          },
          quote: {
            symbol: "CSPR-USD",
            price: 0.041,
            asOf: new Date(options.nowMs - 10 * 60_000).toISOString(),
            source: "paid-oracle",
            expiresAt: new Date(options.nowMs - 60_000).toISOString(),
          },
        };
      }

      if (options.mode === "always-fresh") {
        return {
          status: 200,
          paymentReceipt: {
            mode: "local-simulated",
            authorizationId,
            settled: true,
          },
          quote: {
            symbol: "CSPR-USD",
            price: 0.0421,
            asOf: new Date(options.nowMs - 5_000).toISOString(),
            source: "paid-oracle",
            expiresAt: new Date(options.nowMs + 5 * 60_000).toISOString(),
          },
        };
      }

      // stale-then-fresh: first paid response is stale; subsequent responses are fresh
      if (paidCalls === 1) {
        return {
          status: 200,
          paymentReceipt: {
            mode: "local-simulated",
            authorizationId,
            settled: true,
          },
          quote: {
            symbol: "CSPR-USD",
            price: 0.0399,
            asOf: new Date(options.nowMs - 10 * 60_000).toISOString(),
            source: "paid-oracle",
            expiresAt: new Date(options.nowMs - 30_000).toISOString(),
          },
        };
      }

      return {
        status: 200,
        paymentReceipt: {
          mode: "local-simulated",
          authorizationId,
          settled: true,
        },
        quote: {
          symbol: "CSPR-USD",
          price: 0.0423,
          asOf: new Date(options.nowMs - 3_000).toISOString(),
          source: "paid-oracle",
          expiresAt: new Date(options.nowMs + 5 * 60_000).toISOString(),
        },
      };
    },
  };
}

export function simulatePaymentHeader(attempt: number): string {
  return `TEMPER-LOCAL-PAYMENT attempt=${attempt} ts=${Date.now()}`;
}
