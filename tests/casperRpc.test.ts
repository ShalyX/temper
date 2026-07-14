import { describe, expect, it } from "vitest";
import { proveCasperRpc } from "../src/casper/casperLive.js";

describe("proveCasperRpc", () => {
  it("reaches Casper Testnet RPC", async () => {
    const status = await proveCasperRpc(
      "https://node.testnet.casper.network/rpc",
    );
    expect(status.chainSpecName).toMatch(/casper/i);
    expect(status.protocolVersion.length).toBeGreaterThan(0);
  }, 30_000);
});
