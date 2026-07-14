#!/usr/bin/env node
/**
 * Optional helper: print Casper Testnet RPC status.
 * Does not require a private key.
 */
import { proveCasperRpc } from "../src/casper/casperLive.js";

const status = await proveCasperRpc();
console.log(JSON.stringify(status, null, 2));
