import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { getConfig, TESTNET_TOKENS } from "@agentnet/config";
import { messageBus } from "@agentnet/core";
import { WorkerAgent } from "@agentnet/agents-worker";
import { ClientAgent } from "@agentnet/agents-client";
import type { TaskType } from "@agentnet/types";

const SEED_OUTPUT = path.resolve(process.cwd(), "scripts/seed-output.json");

interface SeedWorker {
  index: number;
  profile: string;
  address: string;
  capabilities: string[];
  feePerTask: string;
  composite: number;
}

function loadSeedWorkers(): SeedWorker[] {
  if (!fs.existsSync(SEED_OUTPUT)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(SEED_OUTPUT, "utf8"));
    return data.workers ?? [];
  } catch {
    return [];
  }
}

function fmt(obj: unknown): string {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

function log(section: string, msg: string, data?: unknown) {
  const ts = new Date().toISOString().slice(11, 19);
  const dataStr = data !== undefined ? `  ${fmt(data)}` : "";
  console.log(`[${ts}] [${section}] ${msg}${dataStr}`);
}

export async function initSharedServices() {
  const cfg = getConfig();
  log("INIT", `Loaded config — oracle: ${cfg.contracts.reputationOracle || "none"}, registry: ${cfg.contracts.workerRegistry || "none"}`);
  return { cfg };
}

export async function main() {
  console.log(`\n${"=".repeat(65)}`);
  console.log("  AgentNet Orchestrator — M-31");
  console.log(`${"=".repeat(65)}\n`);

  const { cfg } = await initSharedServices();

  const seedWorkers = loadSeedWorkers();
  log("SEED", `Loaded ${seedWorkers.length} seeded workers from seed-output.json`);

  const workerAgents: WorkerAgent[] = [];

  if (seedWorkers.length > 0) {
    for (const sw of seedWorkers.slice(0, 10)) {
      try {
        const agent = new WorkerAgent({
          id: `worker-${sw.index}`,
          type: "worker",
          wallet: sw.address,
          privateKey: cfg.privateKey,
          capabilities: sw.capabilities as TaskType[],
          feePerTask: BigInt(sw.feePerTask),
          preferredToken: TESTNET_TOKENS.WETH,
        });
        await agent.start();
        workerAgents.push(agent);
        log("WORKER", `Started worker-${sw.index} (${sw.profile}) at ${sw.address.slice(0, 10)}...`);
      } catch (err) {
        log("WORKER", `Failed to start worker-${sw.index}`, err);
      }
    }
  } else {
    log("WORKER", "No seed workers found — starting 3 demo workers");
    const capSets: TaskType[][] = [
      ["pool-indexer", "wallet-summarizer"],
      ["token-fact-checker", "pool-indexer"],
      ["wallet-summarizer", "token-fact-checker"],
    ];
    for (let i = 0; i < 3; i++) {
      try {
        const agent = new WorkerAgent({
          id: `worker-demo-${i}`,
          type: "worker",
          wallet: cfg.privateKey,
          privateKey: cfg.privateKey,
          capabilities: capSets[i],
          feePerTask: BigInt("10000000000000000"),
          preferredToken: TESTNET_TOKENS.WETH,
        });
        await agent.start();
        workerAgents.push(agent);
        log("WORKER", `Started demo worker-${i} with caps: ${capSets[i].join(", ")}`);
      } catch (err) {
        log("WORKER", `Failed to start demo worker-${i}`, err);
      }
    }
  }

  const clientDefs = [
    {
      id: "client-A",
      label: "Client A (USDC only)",
      tokens: [TESTNET_TOKENS.USDC],
      prefs: ["pool-indexer", "wallet-summarizer"] as TaskType[],
    },
    {
      id: "client-B",
      label: "Client B (WETH only)",
      tokens: [TESTNET_TOKENS.WETH],
      prefs: ["token-fact-checker", "pool-indexer"] as TaskType[],
    },
    {
      id: "client-C",
      label: "Client C (USDT + random)",
      tokens: [TESTNET_TOKENS.USDT, TESTNET_TOKENS.USDC, TESTNET_TOKENS.WETH],
      prefs: ["pool-indexer", "wallet-summarizer", "token-fact-checker"] as TaskType[],
    },
  ];

  const clientAgents: ClientAgent[] = [];
  for (const def of clientDefs) {
    try {
      const agent = new ClientAgent({
        id: def.id,
        type: "client",
        wallet: cfg.privateKey,
        privateKey: cfg.privateKey,
        paymentTokens: def.tokens,
        taskPreferences: def.prefs,
        budget: BigInt("100000000000000000"),
      });
      await agent.start();
      clientAgents.push(agent);
      log("CLIENT", `Started ${def.label}`);
    } catch (err) {
      log("CLIENT", `Failed to start ${def.id}`, err);
    }
  }

  messageBus.onAny((msg) => {
    if (msg.type === "heartbeat") return;
    log("BUS", `${msg.type} from=${msg.from.slice(0, 12)} to=${msg.to.slice(0, 12)}`);
  });

  log("SYSTEM", `Running — ${workerAgents.length} workers, ${clientAgents.length} clients`);
  log("SYSTEM", "Press Ctrl+C to stop\n");

  process.on("SIGINT", async () => {
    console.log("\n");
    log("SHUTDOWN", "Stopping all agents...");

    for (const agent of clientAgents) {
      await agent.stop().catch(() => {});
    }
    for (const agent of workerAgents) {
      await agent.stop().catch(() => {});
    }

    console.log(`\n${"=".repeat(65)}`);
    console.log("  Final Stats");
    console.log(`${"=".repeat(65)}`);
    console.log(`  Workers: ${workerAgents.length}`);
    console.log(`  Clients: ${clientAgents.length}`);
    const totalTasks = clientAgents.reduce((s, c) => s + c.getActivity().length, 0);
    console.log(`  Total tasks completed: ${totalTasks}`);
    for (const c of clientAgents) {
      const acts = c.getActivity();
      console.log(`  ${c.address.slice(0, 10)}... — ${acts.length} tasks`);
    }
    console.log();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Orchestrator failed:", err);
  process.exit(1);
});
