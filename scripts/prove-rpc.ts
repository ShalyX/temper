import { proveCasperRpc } from "../src/casper/casperLive.js";

const status = await proveCasperRpc();
console.log(JSON.stringify(status, null, 2));
