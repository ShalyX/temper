import { readFileSync, existsSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import type { AnchorResult } from "./anchor.js";

export type CasperLiveConfig = {
  rpcUrl: string;
  networkName: string;
  secretKeyPath: string;
  keyAlgo: "ed25519" | "secp256k1";
  /** Optional fixed recipient; defaults to self-transfer */
  recipientPublicKeyHex?: string;
  /** Transfer amount in motes (string). Default 2_500_000_000 (2.5 CSPR) */
  transferAmountMotes?: string;
  paymentAmountMotes?: string;
};

export function loadCasperConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): CasperLiveConfig | null {
  const secretKeyPath = env.CASPER_SECRET_KEY_PATH;
  if (!secretKeyPath) return null;
  if (!existsSync(secretKeyPath)) {
    throw new Error(`CASPER_SECRET_KEY_PATH not found: ${secretKeyPath}`);
  }
  return {
    rpcUrl: env.CASPER_RPC_URL ?? "https://node.testnet.casper.network/rpc",
    networkName: env.CASPER_NETWORK_NAME ?? "casper-test",
    secretKeyPath,
    keyAlgo: (env.CASPER_KEY_ALGO as "ed25519" | "secp256k1") ?? "ed25519",
    recipientPublicKeyHex: env.CASPER_RECIPIENT_PUBLIC_KEY,
    transferAmountMotes: env.CASPER_TRANSFER_MOTES ?? "2500000000",
    paymentAmountMotes: env.CASPER_PAYMENT_MOTES ?? "100000000",
  };
}

async function loadCasperSdk(): Promise<any> {
  const mod: any = await import("casper-js-sdk");
  return mod.default ?? mod;
}

export async function proveCasperRpc(
  rpcUrl = process.env.CASPER_RPC_URL ??
    "https://node.testnet.casper.network/rpc",
): Promise<{ chainSpecName: string; protocolVersion: string }> {
  const sdk = await loadCasperSdk();
  const handler = new sdk.HttpHandler(rpcUrl);
  const client = new sdk.RpcClient(handler);
  const status = await client.getStatus();
  return {
    chainSpecName: status.chainSpecName ?? status.chainspec_name ?? "unknown",
    protocolVersion: status.protocolVersion ?? status.protocol_version ?? "unknown",
  };
}

/**
 * Returns a function that submits a real CSPR transfer on Casper Testnet
 * using casper-js-sdk v5 (TransactionV1 / putTransaction).
 */
export async function createLiveCasperAnchor(
  config: CasperLiveConfig,
): Promise<() => Promise<AnchorResult>> {
  const sdk = await loadCasperSdk();

  const pem = readFileSync(config.secretKeyPath, "utf8");
  const algo =
    config.keyAlgo === "secp256k1"
      ? sdk.KeyAlgorithm.SECP256K1
      : sdk.KeyAlgorithm.ED25519;

  const privateKey = await sdk.PrivateKey.fromPem(pem, algo);
  const senderHex: string =
    privateKey.publicKey?.toHex?.() ??
    privateKey.publicKey?.toAccountHex?.() ??
    String(privateKey.publicKey);

  const recipientHex = config.recipientPublicKeyHex ?? senderHex;
  const amount = config.transferAmountMotes ?? "2500000000";
  const payment = config.paymentAmountMotes ?? "100000000";

  const handler = new sdk.HttpHandler(config.rpcUrl);
  const client = new sdk.RpcClient(handler);

  // Connectivity check once at factory time
  await client.getStatus();

  return async () => {
    const status = await client.getStatus();
    const apiVersion: string =
      status.apiVersion ?? status.api_version ?? "2.0.0";

    let transaction: any;
    if (typeof sdk.makeCsprTransferTransaction === "function") {
      transaction = sdk.makeCsprTransferTransaction({
        senderPublicKeyHex: senderHex.replace(/^0x/, ""),
        recipientPublicKeyHex: recipientHex.replace(/^0x/, ""),
        transferAmount: amount,
        chainName: config.networkName,
        casperNetworkApiVersion: apiVersion,
        paymentAmount: payment,
        memo: Date.now() % 1_000_000_000,
      });
    } else {
      const builder = new sdk.NativeTransferBuilder()
        .from(sdk.PublicKey.fromHex(senderHex.replace(/^0x/, "")))
        .target(sdk.PublicKey.fromHex(recipientHex.replace(/^0x/, "")))
        .amount(amount)
        .chainName(config.networkName)
        .payment(Number(payment), 1);
      transaction = builder.build();
    }

    // Sign
    if (typeof transaction.sign === "function") {
      transaction.sign(privateKey);
    } else if (typeof transaction.setSignature === "function") {
      const bytes =
        transaction.hash?.toBytes?.() ??
        transaction.getHash?.()?.toBytes?.() ??
        transaction.hash;
      const sig = privateKey.signAndAddAlgorithmBytes
        ? privateKey.signAndAddAlgorithmBytes(bytes)
        : privateKey.sign(bytes);
      transaction.setSignature(sig, privateKey.publicKey);
    } else {
      throw new Error("Unable to sign Casper transaction with this SDK build");
    }

    const result = await client.putTransaction(transaction);
    const txHash =
      result.transactionHash?.toHex?.() ??
      result.transaction_hash?.Deploy ??
      result.transaction_hash?.Version1 ??
      result.hash ??
      JSON.stringify(result);

    return {
      mode: "casper-testnet",
      txHash: String(txHash),
      deployHash: String(txHash),
      note: `Live Casper ${config.networkName} transfer submitted via putTransaction`,
    };
  };
}

export function makeOfflineProof(label: string): AnchorResult {
  const digest = createHash("sha256")
    .update(`${label}:${randomUUID()}`)
    .digest("hex");
  return {
    mode: "memory",
    txHash: `mem_${digest.slice(0, 32)}`,
    note: "Offline proof hash only",
  };
}
