# Casper Testnet funding (required for live transfers)

Temper can submit real Testnet transactions when a **funded** key is configured.

## Generated demo key (local only — never commit)

Public key (share this with the faucet / explorer):

```text
0143c206dc7ac5a12f973c8e496e786af95e5c3ef7100eeeffa280ac166322c0f2
```

Account page (after first funding):

https://testnet.cspr.live/account/0143c206dc7ac5a12f973c8e496e786af95e5c3ef7100eeeffa280ac166322c0f2

## Fund via official faucet

1. Install [Casper Wallet](https://www.casperwallet.io/)
2. Import the secret key PEM from your secure host path (`keys/secret_key.pem` is gitignored), **or** create a new wallet and send test CSPR to the public key above
3. Open https://testnet.cspr.live/tools/faucet while signed in
4. Click **Request tokens** (once per account, ~5000 test CSPR)

If you need more than the faucet amount: `casper-testnet@make.services`

## Configure Temper

```bash
export CASPER_SECRET_KEY_PATH=/absolute/path/to/secret_key.pem
export CASPER_NETWORK_NAME=casper-test
export CASPER_RPC_URL=https://node.testnet.casper.network/rpc

npm run temper -- status
npm run temper -- transfer
npm run temper -- run stale-quote --live
```

Without funding, `transfer` returns `no such addressable entity` (account has never been created on-chain). That is expected.

## Evidence checklist

After funding:

- [ ] `npm run temper -- transfer` prints a transaction hash
- [ ] Explorer link opens and shows success
- [ ] `npm run temper -- run stale-quote --live` shows `registry=casper-testnet`
- [ ] Paste hashes into `SUBMISSION/EVIDENCE.md`
