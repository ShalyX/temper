# Temper — live evidence log

## Network

- Chain: Casper Testnet (`casper-test`)
- RPC: `https://node.testnet.casper.network/rpc`
- Verified RPC status: protocol **2.2.2** (see `npm run prove:rpc`)

## Account

- Public key: `0143c206dc7ac5a12f973c8e496e786af95e5c3ef7100eeeffa280ac166322c0f2`
- Explorer: https://testnet.cspr.live/account/0143c206dc7ac5a12f973c8e496e786af95e5c3ef7100eeeffa280ac166322c0f2

## Transactions

| When (UTC) | Purpose | Hash | Explorer | Status |
|------------|---------|------|----------|--------|
| _pending faucet_ | first live transfer | — | — | account not funded yet (`no such addressable entity`) |

## Dual-run (local-simulated x402 + memory anchors)

Reproducible offline:

```bash
npm test
npm run demo
```

Expected: naive FAIL `acted_on_stale_data`, guarded PASS with recovery path.

## Dual-run (live Casper anchors)

```bash
export CASPER_SECRET_KEY_PATH=...
npm run temper -- run stale-quote --live --json
```

Fill after funding:

- Naive anchor tx:
- Guarded anchor tx:
- Report file path:

## Demo video

- Script: `SUBMISSION/DEMO.md`
- URL: _to be added_
