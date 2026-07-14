# Temper — 2 minute demo script

## 0:00–0:15 Problem

Autonomous agents on Casper will pay for data over x402 and then act on-chain.
Happy-path demos hide the dangerous case: the agent paid, got a quote, and the quote was already stale.

## 0:15–0:25 Promise

Temper is a reliability harness. Same scenario, two agents: naive and guarded.

## 0:25–1:25 Walkthrough

1. Open the Temper UI.
2. Select scenario `stale-quote`.
3. Click **Run dual comparison**.
4. Show naive card: FAIL · `acted_on_stale_data` — executed on a 10-minute-old quote.
5. Show guarded card: PASS — recovery path `retry_after_stale → execute_on_fresh_quote`.
6. Point at payment attempts (guarded paid twice) and result anchors.

## 1:25–1:45 Sponsor integration

Call out the Casper stack path:

- x402-shaped paid oracle (`GET /oracle/cspr-usd` returns 402 without payment)
- deterministic policy gate
- dual-run registry entries
- Odra registry schema for Testnet deployment

Be explicit: default demo uses local-simulated payment authorizations so the run is reproducible.

## 1:45–2:00 Why it matters

Casper’s agent economy needs more than agents that trade — it needs agents that fail safely.
Temper is the pre-flight check.

## Closing

Temper: inject the fault, compare the agents, ship the one that recovers.
