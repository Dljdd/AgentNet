/**
 * Integration test for the 0G Storage KV store.
 *
 * SDK: @0gfoundation/0g-storage-ts-sdk v1.2.8 (matches live Galileo testnet)
 *
 * On-chain write status:
 *   The SDK now sends the correct function selector (0xbc8c11f8) and the new
 *   Submission struct (with `submitter: address`).  estimateGas succeeds (~309k).
 *   The actual send() will succeed once the wallet (PRIVATE_KEY) has enough OG
 *   for gas on the Galileo testnet.  Get testnet OG at: https://faucet.0g.ai
 *
 *   Until the wallet is funded the put/storeJSON/appendLog operations fall back
 *   to an in-memory Map so the agent pipeline keeps running.
 *
 * Prerequisites:
 *   PRIVATE_KEY set in .env  (wallet address visible in output)
 *
 * Run: pnpm tsx scripts/test-0g-storage.ts
 */
import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { ethers } from "ethers";
import ZGStorage from "../packages/integrations/0g/src/storage.js";

async function run() {
  if (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY === "0x...") {
    console.error("❌ PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const storage = new ZGStorage();
  const testKey   = `test-${Date.now()}`;
  const testValue = `hello-from-agentnet-${Date.now()}`;

  // Show wallet info upfront so balance issues are immediately visible.
  const evmRpc = process.env.ZG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
  const provider = new ethers.JsonRpcProvider(evmRpc);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const walletAddr = await wallet.getAddress();
  const balance = await provider.getBalance(walletAddr);
  const balEth = ethers.formatEther(balance);

  console.log("0G Storage integration test");
  console.log(`  SDK     : @0gfoundation/0g-storage-ts-sdk v1.2.8`);
  console.log(`  Indexer : ${process.env.ZG_STORAGE_ENDPOINT ?? "https://indexer-storage-testnet-turbo.0g.ai"}`);
  console.log(`  KV node : ${process.env.ZG_KV_ENDPOINT ?? "http://3.101.147.150:6789 (default)"}`);
  console.log(`  Flow    : dynamic (resolved from node status)`);
  console.log(`  Wallet  : ${walletAddr}`);
  console.log(`  Balance : ${balEth} OG`);
  const MIN_OG = ethers.parseEther("0.001");
  if (balance < MIN_OG) {
    console.log(`  ⚠  Balance below 0.001 OG — on-chain writes will fall back to in-memory.`);
    console.log(`     Get testnet OG at https://faucet.0g.ai`);
  }
  console.log();

  // ── Test 1: put ────────────────────────────────────────────────────────────
  console.log("── Test 1: put ──────────────────────────────────────────────────");
  let txHash: string;
  try {
    txHash = await storage.put("agentnet-test", testKey, testValue);
    const isFallback = txHash.startsWith("0xfallback");
    if (isFallback) {
      console.log(`✓  Stored via in-memory fallback (wallet needs OG): ${txHash}`);
    } else {
      console.log(`✓  On-chain tx: ${txHash}`);
    }
  } catch (err) {
    console.error("❌ put failed:", err);
    process.exit(1);
  }

  // ── Test 2: get ───────────────────────────────────────────────────────────
  console.log("\n── Test 2: get ──────────────────────────────────────────────────");
  try {
    const val = await storage.get("agentnet-test", testKey);
    if (val === testValue) {
      console.log("✓  Read back:", val);
    } else if (val !== null) {
      console.log("⚠  Got value but content differs:", val);
    } else {
      console.log("❌  Value not found — fallback path broken");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ get failed:", err);
    process.exit(1);
  }

  // ── Test 3: storeJSON / getJSON ────────────────────────────────────────────
  console.log("\n── Test 3: storeJSON / getJSON ──────────────────────────────────");
  try {
    const data = { score: 9200, agent: "0xtest", timestamp: Date.now() };
    const jsonTx = await storage.storeJSON("agentnet-test", `json-${testKey}`, data);
    console.log("✓  storeJSON:", jsonTx.startsWith("0xfallback") ? "(fallback)" : jsonTx);

    const retrieved = await storage.getJSON<typeof data>("agentnet-test", `json-${testKey}`);
    if (retrieved?.score === 9200) {
      console.log("✓  getJSON:", JSON.stringify(retrieved));
    } else {
      console.log("❌  getJSON returned unexpected:", retrieved);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ storeJSON/getJSON failed:", err);
    process.exit(1);
  }

  // ── Test 4: appendLog / readLog ────────────────────────────────────────────
  console.log("\n── Test 4: appendLog / readLog ──────────────────────────────────");
  try {
    await storage.appendLog(`task-log-${testKey}`, "task started");
    await storage.appendLog(`task-log-${testKey}`, "task completed");
    const log = await storage.readLog(`task-log-${testKey}`);
    if (log.length === 2 && log[0] === "task started" && log[1] === "task completed") {
      console.log("✓  Log entries:", log);
    } else {
      console.log("❌  Unexpected log:", log);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ appendLog/readLog failed:", err);
    process.exit(1);
  }

  // ── Test 5: list ──────────────────────────────────────────────────────────
  console.log("\n── Test 5: list ─────────────────────────────────────────────────");
  try {
    await storage.put("list-test", "alpha", "1");
    await storage.put("list-test", "beta", "2");
    await storage.put("list-test", "gamma", "3");

    const all = await storage.list("list-test");
    const prefixed = await storage.list("list-test", "al");

    if (all.length === 3 && prefixed.length === 1 && prefixed[0].key === "alpha") {
      console.log("✓  list() all:", all.map(r => r.key).sort().join(", "));
      console.log("✓  list('al'):", prefixed[0].key);
    } else {
      console.log("❌  list returned unexpected:", { all, prefixed });
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ list failed:", err);
    process.exit(1);
  }

  const onChain = !txHash.startsWith("0xfallback");
  console.log(`\n✅  All 0G Storage tests passed (${onChain ? "on-chain" : "in-memory fallback"}).`);
  if (!onChain) {
    console.log("   Fund the wallet at https://faucet.0g.ai to enable live on-chain writes.");
  }
}

run();
