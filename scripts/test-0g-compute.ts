/**
 * Live test for the 0G Compute integration.
 *
 * Prerequisites:
 *   1. Get an API key from https://pc.0g.ai (deposit some 0G tokens first)
 *   2. Set ZG_COMPUTE_API_KEY=<your-key> in .env
 *   3. ZG_COMPUTE_ENDPOINT=https://router-api.0g.ai/v1 (already in .env.example)
 *
 * Run: pnpm tsx scripts/test-0g-compute.ts
 */
import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { ZGCompute } from "../packages/integrations/0g/src/compute.js";

async function run() {
  const endpoint = process.env.ZG_COMPUTE_ENDPOINT;
  const apiKey   = process.env.ZG_COMPUTE_API_KEY;

  if (!endpoint) {
    console.error("❌ ZG_COMPUTE_ENDPOINT not set in .env");
    process.exit(1);
  }
  if (!apiKey || apiKey === "your-0g-compute-api-key") {
    console.error("❌ ZG_COMPUTE_API_KEY not set — get one from https://pc.0g.ai");
    process.exit(1);
  }

  const compute = new ZGCompute(endpoint, apiKey);

  console.log(`0G Compute endpoint : ${endpoint}`);
  console.log(`API key             : ${apiKey.slice(0, 8)}...`);
  console.log();

  // ── Test 1: Basic inference ────────────────────────────────────────────────
  console.log("── Test 1: Basic inference ──────────────────────────────────────");
  try {
    const result = await compute.inference(
      'Reply with exactly: "0G Compute is live on AgentNet." — nothing else.',
      { maxTokens: 32, temperature: 0 }
    );
    console.log("✓ Response:", result.trim());
  } catch (err) {
    console.error("❌ inference failed:", err);
    process.exit(1);
  }

  // ── Test 2: Wallet summarizer use-case ──────────────────────────────────────
  console.log("\n── Test 2: summarize (wallet-summarizer task) ───────────────────");
  try {
    const result = await compute.summarize(
      "txCount: 142, ethBalance: 0.52 ETH, topProtocol: Uniswap v3",
      "Summarize this wallet's on-chain activity in one sentence."
    );
    console.log("✓ Summary:", result.trim().slice(0, 200));
  } catch (err) {
    console.error("❌ summarize failed:", err);
    process.exit(1);
  }

  // ── Test 3: Token fact-checker use-case ───────────────────────────────────
  console.log("\n── Test 3: factCheck (token-fact-checker task) ─────────────────");
  try {
    const result = await compute.factCheck(
      "This token has no mint function and liquidity is locked.",
      "Contract bytecode does not contain the mint(address,uint256) selector. LP tokens locked in Unicrypt for 2 years."
    );
    console.log("✓ Verdict:", result.verdict, `(confidence: ${result.confidence}%)`);
    console.log("  Reasoning:", result.reasoning.slice(0, 200));
  } catch (err) {
    console.error("❌ factCheck failed:", err);
    process.exit(1);
  }

  console.log("\n✅  0G Compute integration tests complete.");
}

run();
