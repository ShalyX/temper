import { readFileSync, existsSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import type { AnchorResult } from "./anchor.js";

export type CasperLiveConfig = {
  rpcUrl: string;
  networkName: string;
  secretKeyPath: string;
  keyAlgo: "ed25519" | "secp256k1";
  recipientPublicKeyHex?: string;
  transferAmountMotes?: string;
  paymentAmountMotes?: string;
};

async function loadCasperSdk(): Promise<any> {
  const mod: any = await import("casper-js-sdk");
  return mod.default ?? mod;
}

function bytesToHex(bytes: Uint8Array | number[] | undefined): string | undefined {
  if (!bytes) return undefined;
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractTxHash(tx: any, putResult?: any): string {
  const fromPut =
    putResult?.transactionHash?.transactionV1 ??
    putResult?.transactionHash?.deploy ??
    putResult?.transactionHash?.toHex?.() ??
    putResult?.transaction_hash?.Version1 ??
    putResult?.transaction_hash?.Deploy ??
    putResult?.hash;
  if (fromPut) return String(fromPut);

  const hashObj = tx?.hash;
  const hex =
    hashObj?.toHex?.() ??
    bytesToHex(hashObj?.hashBytes) ??
    bytesToHex(hashObj?.transactionV1?.hashBytes) ??
    bytesToHex(tx?.originTransactionV1?.hash?.hashBytes);
  if (hex) return hex.startsWith("0x") ? hex.slice(2) : hex;
  throw new Error("Unable to extract Casper transaction hash");
}

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
    protocolVersion:
      status.protocolVersion ?? status.protocol_version ?? "unknown",
  };
}

export async function getPublicKeyHexFromConfig(
  config: CasperLiveConfig,
): Promise<string> {
  const sdk = await loadCasperSdk();
  const pem = readFileSync(config.secretKeyPath, "utf8");
  const algo =
    config.keyAlgo === "secp256k1"
      ? sdk.KeyAlgorithm.SECP256K1
      : sdk.KeyAlgorithm.ED25519;
  const privateKey = await sdk.PrivateKey.fromPem(pem, algo);
  return privateKey.publicKey.toHex();
}

/**
 * Submit a real CSPR transfer on Casper Testnet.
 * Requires a funded account (faucet: https://testnet.cspr.live/tools/faucet).
 */
export async function submitLiveTransfer(
  config: CasperLiveConfig,
): Promise<AnchorResult> {
  const sdk = await loadCasperSdk();
  const pem = readFileSync(config.secretKeyPath, "utf8");
  const algo =
    config.keyAlgo === "secp256k1"
      ? sdk.KeyAlgorithm.SECP256K1
      : sdk.KeyAlgorithm.ED25519;

  const privateKey = await sdk.PrivateKey.fromPem(pem, algo);
  const senderHex: string = privateKey.publicKey.toHex();
  const recipientHex = config.recipientPublicKeyHex ?? senderHex;
  const amount = config.transferAmountMotes ?? "2500000000";
  const payment = config.paymentAmountMotes ?? "100000000";

  const handler = new sdk.HttpHandler(config.rpcUrl);
  const client = new sdk.RpcClient(handler);
  const status = await client.getStatus();
  const apiVersion: string =
    status.apiVersion ?? status.api_version ?? "2.0.0";

  const transaction = sdk.makeCsprTransferTransaction({
    senderPublicKeyHex: senderHex.replace(/^0x/, ""),
    recipientPublicKeyHex: recipientHex.replace(/^0x/, ""),
    transferAmount: amount,
    chainName: config.networkName,
    casperNetworkApiVersion: apiVersion,
    paymentAmount: payment,
    memo: Date.now() % 1_000_000_000,
  });

  if (typeof transaction.sign !== "function") {
    throw new Error("Transaction object has no sign() method");
  }
  transaction.sign(privateKey);

  const putResult = await client.putTransaction(transaction);
  const txHash = extractTxHash(transaction, putResult);

  return {
    mode: "casper-testnet",
    txHash,
    deployHash: txHash,
    note: `Live Casper ${config.networkName} transfer via putTransaction`,
  };
}

/**
 * Factory used by agents: each call submits a new live transfer.
 */
export async function createLiveCasperAnchor(
  config: CasperLiveConfig,
): Promise<() => Promise<AnchorResult>> {
  // Connectivity check once
  await proveCasperRpc(config.rpcUrl);
  return async () => submitLiveTransfer(config);
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
