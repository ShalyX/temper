# Temper — Submission notes

## One-liner

Temper is a reliability harness that proves whether a Casper agent handles x402 paid-data faults safely — with a dual-run naive vs guarded demo.

## Track fit

Casper Innovation Track · Agentic AI · DeFi/RWA safety infrastructure · x402

## Eligibility checklist

- [x] Working prototype (CLI + web dual-run)
- [x] Open-source GitHub repo with README
- [ ] Demo video (record from DEMO.md)
- [ ] Casper Testnet transaction-producing component (live key path; local anchors labeled honestly until key is configured)
- [x] Original work for the buildathon concept

## Judging map

| Criterion | How Temper addresses it |
|-----------|-------------------------|
| Technical execution | Deterministic policy, dual harness, tests, CLI, API, UI |
| Innovation | Chaos/reliability layer for agents — complementary to trading/oracle apps |
| Use of AI / agentic systems | Autonomous agent decision loops with recovery paths |
| Real-world applicability | Pre-deploy safety for agent developers |
| UX | Side-by-side fail/pass comparison |
| Working smart contracts | Odra registry sketch + live Casper anchor hook |
| Long-term plans | Adapter SDK + scenario pack + Testnet registry |
| Ecosystem impact | Makes other Casper agent BUIDLs safer to ship |

## Modes (do not overclaim)

| Mode | Meaning |
|------|---------|
| `x402: local-simulated` | Challenge/response uses x402 shape; payment authorization is local demo, not facilitator settlement |
| `registry: memory` | Result anchors are local hashes |
| live Casper | Requires funded Testnet key + SDK adapter |

## Closest related submissions (differentiation)

Not another portfolio bot, yield router, RWA oracle, or wallet assistant.

Temper evaluates agent recovery under fault injection and is meant to sit underneath those apps.
