# Temper

**Reliability testing for autonomous Casper agents.**

Temper injects realistic faults at the x402 paid-data boundary, runs a **naive** agent and a **policy-guarded** agent on the same scenario, and shows whether the agent recovers before it would act on bad data.

Built for the **Casper Agentic Buildathon 2026 — Final Round**.

## Who it is for

Developers shipping autonomous agents on Casper who need more than a happy-path demo before real funds or users are involved.

## Problem

Most agent demos only show the success path. Production agents fail when:

- a paid API returns **stale** data
- a payload is **malformed**
- a quote has **expired**
- settlement or RPC paths degrade

Without a harness, those failures show up after deployment.

## Solution

Temper runs a dual comparison:

| Agent | Behavior |
|-------|----------|
| **Naive** | Pays once, trusts the first payload, executes |
| **Guarded** | Pays, checks freshness/integrity, retries on stale, only executes on clean data |

The memorable demo moment: **same goal, same fault — naive fails, guarded recovers**.

## Sponsor integration (Casper)

Temper is built around the Casper agent stack:

1. **x402-shaped paid oracle** — `402 Payment Required` → payment header → protected quote  
2. **Agent policy** — deterministic freshness gate (not vibes-only LLM judgment)  
3. **Result registry** — run outcomes anchored (memory mode by default; Casper Testnet path when a funded key is configured)  
4. **Odra registry sketch** — `contracts/temper_registry_odra_sketch.rs` for the on-chain schema

**Honest labeling:** the default demo uses **local-simulated** x402 authorizations so the dual-run is reproducible offline. This is not a fake “mainnet settlement” claim. Wire `CASPER_SECRET_KEY_PATH` + facilitator config for live settlement work.

## How it works

```text
Scenario: stale-quote
  → Oracle challenges with HTTP 402 (x402 shape)
  → Agent pays (local authorization header in demo mode)
  → First quote is intentionally stale (10 minutes old)
  → Naive agent executes anyway            → FAIL (acted_on_stale_data)
  → Guarded agent blocks, retries, gets fresh quote → PASS
  → Both outcomes recorded in the result registry
```

## Quick start

```bash
npm install
npm test
npm run demo          # CLI dual-run for stale-quote
npm run dev           # UI + API on http://127.0.0.1:4173
```

### CLI

```bash
npm run temper -- list
npm run temper -- run stale-quote --dual
npm run temper -- run malformed-payload --json
```

### API

- `GET /api/health`
- `GET /api/scenarios`
- `POST /api/run` body: `{ "scenarioId": "stale-quote" }`
- `GET /oracle/cspr-usd` — x402-shaped paid endpoint (send `Payment-Signature` or `X-Payment` to receive data)

## Tech stack

- TypeScript / Node 20+
- Vitest
- Zero-framework HTTP UI (`public/`)
- Optional: `casper-js-sdk`, `@make-software/casper-x402` for live paths

## Project layout

```text
src/
  core/         policy + dual-run harness
  agents/       naive + guarded agents
  x402/         local paid oracle (x402 challenge shape)
  casper/       memory registry + live anchor hooks
  server/       demo API + static UI
  cli.ts        temper CLI
public/         dual-run comparison UI
contracts/      Odra registry sketch
tests/          policy + harness tests
SUBMISSION/     hackathon notes + demo script
```

## Configuration

Copy `.env.example` to `.env` if you need live Casper settings. Never commit keys.

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default 4173) |
| `TEMPER_MODE` | `local` (default) |
| `CASPER_SECRET_KEY_PATH` | PEM path for Testnet anchoring |
| `CASPER_RPC_URL` | default Casper Testnet RPC |

## What’s next

- [ ] Pin casper-js-sdk adapter and submit real Testnet deploys for registry entries
- [ ] Optional live facilitator via `@make-software/casper-x402`
- [ ] Compile/deploy Odra `TemperRegistry` to Testnet
- [ ] Additional scenarios: RPC timeout, rejected deploy, expired payment window
- [ ] Agent adapter SDK (`temper run --agent-cmd ...`)

## License

MIT
