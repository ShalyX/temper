import { describe, expect, it } from "vitest";
import {
  evaluateFreshness,
  type MarketQuote,
} from "../src/core/policy.js";

describe("evaluateFreshness", () => {
  const now = Date.parse("2026-07-14T12:00:00.000Z");

  it("accepts a quote younger than maxAgeMs", () => {
    const quote: MarketQuote = {
      symbol: "CSPR-USD",
      price: 0.042,
      asOf: "2026-07-14T11:59:30.000Z",
      source: "paid-oracle",
    };
    const result = evaluateFreshness(quote, { nowMs: now, maxAgeMs: 60_000 });
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("fresh");
  });

  it("rejects a stale quote", () => {
    const quote: MarketQuote = {
      symbol: "CSPR-USD",
      price: 0.042,
      asOf: "2026-07-14T11:50:00.000Z",
      source: "paid-oracle",
    };
    const result = evaluateFreshness(quote, { nowMs: now, maxAgeMs: 60_000 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("stale");
    expect(result.ageMs).toBe(600_000);
  });

  it("rejects missing asOf", () => {
    const quote = {
      symbol: "CSPR-USD",
      price: 0.042,
      source: "paid-oracle",
    } as MarketQuote;
    const result = evaluateFreshness(quote, { nowMs: now, maxAgeMs: 60_000 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("missing_as_of");
  });
});
