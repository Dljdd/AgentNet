/**
 * Live integration test for the KeeperHub integration (M-13 + M-14).
 * Requires KEEPERHUB_API_KEY in .env.
 *
 * What this tests:
 *   1. API authentication — a 401 here means the key is wrong
 *   2. Workflow execution — verifies the execute endpoint accepts our payload
 *   3. Execution polling — verifies status polling works
 *   4. Template resolution — the workflow reaches the contract call
 *      (may fail with "Unauthorized updater" until the deployer runs
 *       `pnpm tsx scripts/authorize-keeper.ts` with a valid PRIVATE_KEY)
 */
import dotenv from "dotenv";
import { KeeperHubClient, KeeperHubSettlement, WORKFLOW_IDS } from "../packages/integrations/keeperhub/src/index.js";

dotenv.config();

const TEST_AGENT = "0x000000000000000000000000000000000000dead";

async function run() {
  const apiKey = process.env.KEEPERHUB_API_KEY;
  if (!apiKey || apiKey === "your-keeperhub-api-key") {
    console.error("❌ KEEPERHUB_API_KEY not set in .env");
    process.exit(1);
  }

  const client = new KeeperHubClient({ pollIntervalMs: 3_000, timeoutMs: 300_000 });
  const settlement = new KeeperHubSettlement(client);

  console.log("✓ KeeperHub base URL:", client.baseUrl);
  console.log("✓ Reputation workflow ID:", WORKFLOW_IDS.reputationUpdate);
  console.log("✓ Payment workflow ID   :", WORKFLOW_IDS.paymentSettle);
  console.log();

  // ── Test 1: API connectivity (executeWorkflow) ──────────────────────────────
  console.log("── Test 1: Execute reputation workflow ──────────────────────────");
  let executionId: string;
  try {
    const res = await client.executeWorkflow(WORKFLOW_IDS.reputationUpdate, {
      agentAddress: TEST_AGENT,
      accuracy: "8500",
      timeliness: "7800",
      uptime: "9200",
    });
    executionId = res.executionId;
    console.log("✓ Workflow accepted — executionId:", executionId);
  } catch (err) {
    console.error("❌ executeWorkflow failed:", err);
    process.exit(1);
  }

  // ── Test 2: Execution polling ───────────────────────────────────────────────
  console.log("\n── Test 2: Poll execution status ────────────────────────────────");
  try {
    const result = await client.waitForExecution(executionId);
    console.log("✓ Terminal status reached:", result.status);
    if (result.status === "error") {
      const errMsg = result.errorContext?.error ?? JSON.stringify(result);
      if (errMsg.includes("Unauthorized updater")) {
        console.log("⚠  Contract rejected (expected): KeeperHub wallet not yet authorized.");
        console.log("   Run `pnpm tsx scripts/authorize-keeper.ts` with a valid PRIVATE_KEY.");
      } else {
        console.log("⚠  Unexpected error:", errMsg);
      }
    } else {
      const actionNode = result.nodeStatuses?.find(n => n.result?.transactionHash);
      console.log("✓ txHash:", actionNode?.result?.transactionHash ?? "(none)");
    }
  } catch (err) {
    console.error("❌ waitForExecution failed:", err);
    process.exit(1);
  }

  // ── Test 3: settleReputationUpdate convenience method ──────────────────────
  console.log("\n── Test 3: settleReputationUpdate (settlement layer) ────────────");
  try {
    const receipt = await settlement.settleReputationUpdate({
      agentAddress: TEST_AGENT,
      accuracy: 9000,
      timeliness: 8800,
      uptime: 9500,
    });
    console.log("✓ KeeperReceipt:", JSON.stringify(receipt, null, 2));
  } catch (err) {
    const msg = String(err);
    if (msg.includes("Unauthorized updater")) {
      console.log("⚠  Contract auth gate hit (expected until PRIVATE_KEY is set).");
    } else {
      console.error("❌ settleReputationUpdate failed:", err);
      process.exit(1);
    }
  }

  console.log("\n✅  KeeperHub integration tests complete.");
}

run();
