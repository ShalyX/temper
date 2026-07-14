# Temper — DoraHacks submission draft

## Title
Temper — Reliability harness for autonomous Casper agents

## Tagline
Inject x402 paid-data faults. Compare a naive agent to a policy-guarded agent. Ship the one that recovers.

## Live links
- Demo: https://temper-one.vercel.app
- Repo: https://github.com/ShalyX/temper
- Demo script: SUBMISSION/DEMO.md
- Funding for live tx: SUBMISSION/FUNDING.md
- Evidence log: SUBMISSION/EVIDENCE.md

## Description (paste-ready)

Temper is a reliability testing harness for autonomous agents on Casper.

Most agent demos only show the happy path. Temper injects a realistic failure at the x402 paid-oracle boundary (first paid quote is stale/expired), then runs two agents on the same scenario:

1. **Naive agent** — pays once, trusts the payload, executes → **FAIL**
2. **Guarded agent** — checks freshness, retries, executes only on clean data → **PASS**

The dual-run comparison is the product. Temper is infrastructure for the Casper agent economy — complementary to trading bots, RWA oracles, and wallets — not another portfolio agent.

**Casper integration**
- x402-shaped paid oracle (`402` challenge → payment header → quote)
- Deterministic policy gate (not vibes-only LLM judgment)
- Casper Testnet RPC connectivity verified (protocol 2.2.2)
- Live transfer path via casper-js-sdk v5 (`putTransaction`) when a funded Testnet key is configured
- Odra registry schema sketch for on-chain result storage

**Honest labels**
Default demo uses local-simulated x402 authorizations and memory anchors so judges can reproduce the dual-run offline. Live Testnet transfers require a funded account (official faucet).

## Tracks / tags
Casper · Agentic · Blockchain · Web3 · AI Agents · DeFi · RWA · x402

## Requirements checklist
- [x] GitHub link
- [x] Working prototype (CLI + web)
- [x] Demo video script (record from DEMO.md)
- [ ] Demo video uploaded
- [ ] Live Testnet tx hash (after faucet fund)
- [x] README + submission notes
