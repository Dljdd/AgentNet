import { createPublicClient, http } from "viem";
import { messageBus, createMessage } from "@agentnet/core";
import { getConfig, ZG_TESTNET } from "@agentnet/config";
import type { TaskRequest, TaskResult, TaskType } from "@agentnet/types";
import { nanoid } from "nanoid";

const WORKER_REGISTRY_ABI = [
  {
    name: "getActiveWorkers",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    name: "getWorker",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "wallet", type: "address" },
          { name: "metadataUri", type: "string" },
          { name: "feePerTask", type: "uint256" },
          { name: "capabilities", type: "string[]" },
          { name: "active", type: "bool" },
          { name: "registeredAt", type: "uint256" },
        ],
      },
    ],
  },
] as const;

const REPUTATION_ORACLE_ABI = [
  {
    name: "getScore",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "accuracy", type: "uint256" },
          { name: "timeliness", type: "uint256" },
          { name: "uptime", type: "uint256" },
          { name: "composite", type: "uint256" },
          { name: "totalJobs", type: "uint256" },
          { name: "lastUpdated", type: "uint256" },
        ],
      },
    ],
  },
] as const;

const zgChain = {
  id: ZG_TESTNET.chainId,
  name: ZG_TESTNET.name,
  nativeCurrency: ZG_TESTNET.nativeCurrency,
  rpcUrls: {
    default: { http: [ZG_TESTNET.rpcUrl] },
    public: { http: [ZG_TESTNET.rpcUrl] },
  },
} as const;

function getPublicClient() {
  const cfg = getConfig();
  return createPublicClient({
    chain: zgChain,
    transport: http(cfg.zgRpcUrl),
  });
}

async function findBestWorker(taskType: TaskType): Promise<string | null> {
  const cfg = getConfig();
  const registryAddress = cfg.contracts.workerRegistry;
  if (!registryAddress) return null;

  const client = getPublicClient();
  try {
    const workers = (await client.readContract({
      address: registryAddress as `0x${string}`,
      abi: WORKER_REGISTRY_ABI,
      functionName: "getActiveWorkers",
    })) as `0x${string}`[];

    let best: string | null = null;
    let bestScore = -1n;

    for (const addr of workers) {
      const workerInfo = (await client.readContract({
        address: registryAddress as `0x${string}`,
        abi: WORKER_REGISTRY_ABI,
        functionName: "getWorker",
        args: [addr],
      })) as { capabilities: readonly string[]; feePerTask: bigint; active: boolean };

      if (!workerInfo.active || !workerInfo.capabilities.includes(taskType)) continue;

      let composite = 5000n;
      const oracleAddress = cfg.contracts.reputationOracle;
      if (oracleAddress) {
        try {
          const score = (await client.readContract({
            address: oracleAddress as `0x${string}`,
            abi: REPUTATION_ORACLE_ABI,
            functionName: "getScore",
            args: [addr],
          })) as { composite: bigint };
          composite = score.composite;
        } catch {
          composite = 5000n;
        }
      }

      if (composite > bestScore) {
        bestScore = composite;
        best = addr;
      }
    }
    return best;
  } catch {
    return null;
  }
}

async function dispatchTask(
  taskType: TaskType,
  params: Record<string, unknown>,
  workerId: string
): Promise<TaskResult> {
  return new Promise((resolve, reject) => {
    const taskId = nanoid();
    const listenerId = `mcp-${taskId}`;

    const request: TaskRequest = {
      id: taskId,
      type: taskType,
      params,
      requester: listenerId,
      maxFee: BigInt("100000000000000000"),
      paymentToken: "0x0000000000000000000000000000000000000000",
    };

    const timeout = setTimeout(() => {
      messageBus.unregister(listenerId);
      reject(new Error(`Task ${taskId} timed out after 30s`));
    }, 30_000);

    messageBus.register(listenerId, (msg) => {
      if (msg.type === "task-result") {
        const result = msg.payload as TaskResult;
        if (result.taskId === taskId) {
          clearTimeout(timeout);
          messageBus.unregister(listenerId);
          resolve(result);
        }
      }
    });

    messageBus.send(createMessage("task-request", listenerId, workerId, request));
  });
}

export const tools = {
  index_uniswap_pool: {
    description: "Index Uniswap v3 pool swap events and compute volume stats",
    inputSchema: {
      type: "object" as const,
      properties: {
        poolAddress: { type: "string", description: "Pool contract address" },
        blockRange: { type: "number", description: "Number of recent blocks to scan (default 1000)" },
      },
      required: ["poolAddress"],
    },
    async handler(input: { poolAddress: string; blockRange?: number }) {
      const workerId = await findBestWorker("pool-indexer");
      if (!workerId) {
        return { error: "No active pool-indexer worker found" };
      }
      const result = await dispatchTask(
        "pool-indexer",
        { poolAddress: input.poolAddress, blockRange: input.blockRange ?? 1000 },
        workerId
      );
      return result.result;
    },
  },

  summarize_wallet: {
    description: "Generate a natural-language summary of a wallet's on-chain activity",
    inputSchema: {
      type: "object" as const,
      properties: {
        walletAddress: { type: "string", description: "Wallet address to summarize" },
        blockRange: { type: "number", description: "Number of recent blocks to scan (default 5000)" },
      },
      required: ["walletAddress"],
    },
    async handler(input: { walletAddress: string; blockRange?: number }) {
      const workerId = await findBestWorker("wallet-summarizer");
      if (!workerId) {
        return { error: "No active wallet-summarizer worker found" };
      }
      const result = await dispatchTask(
        "wallet-summarizer",
        { walletAddress: input.walletAddress, blockRange: input.blockRange ?? 5000 },
        workerId
      );
      return result.result;
    },
  },

  check_token: {
    description: "Analyze a token contract for honeypot, rug-pull, or scam indicators",
    inputSchema: {
      type: "object" as const,
      properties: {
        tokenAddress: { type: "string", description: "Token contract address" },
      },
      required: ["tokenAddress"],
    },
    async handler(input: { tokenAddress: string }) {
      const workerId = await findBestWorker("token-fact-checker");
      if (!workerId) {
        return { error: "No active token-fact-checker worker found" };
      }
      const result = await dispatchTask(
        "token-fact-checker",
        { tokenAddress: input.tokenAddress },
        workerId
      );
      return result.result;
    },
  },

  get_worker_reputation: {
    description: "Get the reputation score for a specific worker agent",
    inputSchema: {
      type: "object" as const,
      properties: {
        workerAddress: { type: "string", description: "Worker wallet address" },
      },
      required: ["workerAddress"],
    },
    async handler(input: { workerAddress: string }) {
      const cfg = getConfig();
      const oracleAddress = cfg.contracts.reputationOracle;
      if (!oracleAddress) return { error: "ReputationOracle not configured" };

      const client = getPublicClient();
      try {
        const score = (await client.readContract({
          address: oracleAddress as `0x${string}`,
          abi: REPUTATION_ORACLE_ABI,
          functionName: "getScore",
          args: [input.workerAddress as `0x${string}`],
        })) as { accuracy: bigint; timeliness: bigint; uptime: bigint; composite: bigint; totalJobs: bigint; lastUpdated: bigint };

        return {
          address: input.workerAddress,
          accuracy: Number(score.accuracy),
          timeliness: Number(score.timeliness),
          uptime: Number(score.uptime),
          composite: Number(score.composite),
          totalJobs: Number(score.totalJobs),
          lastUpdated: Number(score.lastUpdated),
        };
      } catch (err) {
        return { error: String(err) };
      }
    },
  },

  list_active_workers: {
    description: "List all active worker agents, optionally filtered by capability",
    inputSchema: {
      type: "object" as const,
      properties: {
        capability: {
          type: "string",
          enum: ["pool-indexer", "wallet-summarizer", "token-fact-checker"],
          description: "Filter by task capability",
        },
      },
    },
    async handler(input: { capability?: string }) {
      const cfg = getConfig();
      const registryAddress = cfg.contracts.workerRegistry;
      if (!registryAddress) return { workers: [], error: "WorkerRegistry not configured" };

      const client = getPublicClient();
      try {
        const addresses = (await client.readContract({
          address: registryAddress as `0x${string}`,
          abi: WORKER_REGISTRY_ABI,
          functionName: "getActiveWorkers",
        })) as `0x${string}`[];

        const workers = [];
        for (const addr of addresses) {
          const wi = (await client.readContract({
            address: registryAddress as `0x${string}`,
            abi: WORKER_REGISTRY_ABI,
            functionName: "getWorker",
            args: [addr],
          })) as { capabilities: readonly string[]; feePerTask: bigint; active: boolean; metadataUri: string };

          if (!wi.active) continue;
          if (input.capability && !wi.capabilities.includes(input.capability)) continue;

          workers.push({
            address: addr,
            capabilities: wi.capabilities,
            feePerTask: wi.feePerTask.toString(),
            metadataUri: wi.metadataUri,
          });
        }
        return { workers };
      } catch (err) {
        return { workers: [], error: String(err) };
      }
    },
  },
};
