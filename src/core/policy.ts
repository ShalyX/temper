import type { FreshnessResult, MarketQuote } from "./types.js";

export type { MarketQuote } from "./types.js";

export type FreshnessOptions = {
  nowMs: number;
  maxAgeMs: number;
};

export function evaluateFreshness(
  quote: MarketQuote,
  options: FreshnessOptions,
): FreshnessResult {
  if (!quote?.asOf) {
    return { ok: false, reason: "missing_as_of" };
  }

  const asOfMs = Date.parse(quote.asOf);
  if (Number.isNaN(asOfMs)) {
    return { ok: false, reason: "invalid_as_of" };
  }

  if (quote.expiresAt) {
    const expiresMs = Date.parse(quote.expiresAt);
    if (!Number.isNaN(expiresMs) && options.nowMs > expiresMs) {
      return {
        ok: false,
        reason: "expired",
        ageMs: options.nowMs - asOfMs,
      };
    }
  }

  const ageMs = options.nowMs - asOfMs;
  if (ageMs > options.maxAgeMs) {
    return { ok: false, reason: "stale", ageMs };
  }

  return { ok: true, reason: "fresh", ageMs };
}

export function isExecutableQuote(
  quote: MarketQuote,
  options: FreshnessOptions,
): boolean {
  return evaluateFreshness(quote, options).ok;
}
