import { createPublicClient, http } from "viem";
import { AgentBase } from "@agentnet/core";
import { messageBus, createMessage } from "@agentnet/core";
import { getConfig, ZG_TESTNET } from "@agentnet/config";
import { UniswapSwapClient, PayWithAnyToken } from "@agentnet/integrations-uniswap";
import type {
  AgentConfig,
  AgentMessage,
  TaskType,
  TaskRequest,
  TaskResult,
  PaymentChallenge,
} from "@agentnet/types";
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
    inputs: [{ name: "worker", type: "address" }],
    outputs: [
      { name: "capabilities", type: "string[]" },
      { name: "feePerTask", type: "uint256" },
      { name: "preferredToken", type: "address" },
      { name: "isActive", type: "bool" },
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
      { name: "accuracy", type: "uint256" },
      { name: "timeliness", type: "uint256" },
      { name: "uptime", type: "uint256" },
      { name: "composite", type: "uint256" },
      { name: "totalJobs", type: "uint256" },
      { name: "lastUpdated", type: "uint256" },
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

interface ActivityRecord {
  taskId: string;
  workerAddress: string;
  taskType: TaskType;
  paid: bigint;
  token: string;
  result: unknown;
  timestamp: number;
}

interface PendingTask {
  taskId: string;
  workerAddress: string;
  paymentToken: string;
  resolveFn: (result: TaskResult) => void;
  rejectFn: (err: Error) => void;
}

export class ClientAgent extends AgentBase {
  private paymentTokens: string[];
  private taskPreferences: TaskType[];
  private budget: bigint;
  private payWithAnyToken: PayWithAnyToken;
  private completedTasks: ActivityRecord[] = [];
  private spent: bigint = 0n;
  private taskInterval?: ReturnType<typeof setInterval>;
  private pendingTasks: Map<string, PendingTask> = new Map();
  private publicClient;

  constructor(
    config: AgentConfig & {
      paymentTokens: string[];
      taskPreferences: TaskType[];
      budget: bigint;
    }
  ) {
    super(config);
    this.paymentTokens = config.paymentTokens;
    this.taskPreferences = config.taskPreferences;
    this.budget = config.budget;

    const cfg = getConfig();
    this.publicClient = createPublicClient({
      chain: zgChain,
      transport: http(cfg.zgRpcUrl),
    });

    this.payWithAnyToken = new PayWithAnyToken(
      new UniswapSwapClient(cfg.uniswapApiKey, this.wallet)
    );
  }

  async start(): Promise<void> {
    this.startedAt = Date.now();
    messageBus.register(this.id, (msg) => this.handleMessage(msg));
    this.setStatus("idle");

    this.taskInterval = setInterval(() => {
      this.requestTask().catch((err) =>
        this.logger.error("Task request failed", err)
      );
    }, 30_000);

    this.logger.info("Client agent started", {
      tokens: this.paymentTokens,
      preferences: this.taskPreferences,
    });
  }

  async stop(): Promise<void> {
    if (this.taskInterval) {
      clearInterval(this.taskInterval);
      this.taskInterval = undefined;
    }
    messageBus.unregister(this.id);
    this.setStatus("offline");
    this.logger.info("Client agent stopped", {
      tasksCompleted: this.completedTasks.length,
      totalSpent: this.spent.toString(),
    });
  }

  async handleMessage(message: AgentMessage): Promise<void> {
    if (message.type === "payment") {
      const challenge = message.payload as PaymentChallenge;
      const pending = this.pendingTasks.get(challenge.taskId);
      if (!pending) return;

      const payerToken =
        this.paymentTokens[
          Math.floor(Math.random() * this.paymentTokens.length)
        ];

      try {
        const receipt = await this.payWithAnyToken.fulfillChallenge({
          challenge,
          payerToken,
          payerWallet: this.wallet,
        });
        this.spent += receipt.amountIn;
        pending.paymentToken = payerToken;
        this.logger.info("Payment fulfilled", {
          taskId: challenge.taskId,
          token: payerToken,
          amount: receipt.amountIn.toString(),
        });
      } catch (err) {
        this.logger.warn("Payment fulfillment failed (continuing)", err);
      }
    }

    if (message.type === "task-result") {
      const result = message.payload as TaskResult;
      const pending = this.pendingTasks.get(result.taskId);
      if (!pending) return;

      this.pendingTasks.delete(result.taskId);
      pending.resolveFn(result);
    }
  }

  getActivity(): ActivityRecord[] {
    return [...this.completedTasks];
  }

  private async requestTask(): Promise<void> {
    if (this.status === "working") return;

    const taskType =
      this.taskPreferences[
        Math.floor(Math.random() * this.taskPreferences.length)
      ];
    const payerToken =
      this.paymentTokens[Math.floor(Math.random() * this.paymentTokens.length)];

    const worker = await this.findBestWorker(taskType);
    if (!worker) {
      this.logger.warn(`No active worker found for ${taskType}`);
      return;
    }

    this.setStatus("working");

    const taskId = nanoid();
    const request: TaskRequest = {
      id: taskId,
      type: taskType,
      params: this.buildParams(taskType),
      requester: this.id,
      maxFee: this.budget,
      paymentToken: payerToken,
    };

    const result = await new Promise<TaskResult>((resolve, reject) => {
      const pending: PendingTask = {
        taskId,
        workerAddress: worker.address,
        paymentToken: payerToken,
        resolveFn: resolve,
        rejectFn: reject,
      };
      this.pendingTasks.set(taskId, pending);

      setTimeout(() => {
        if (this.pendingTasks.has(taskId)) {
          this.pendingTasks.delete(taskId);
          reject(new Error(`Task ${taskId} timed out`));
        }
      }, 60_000);

      messageBus.send(createMessage("task-request", this.id, worker.id, request));
    });

    this.completedTasks.push({
      taskId,
      workerAddress: worker.address,
      taskType,
      paid: this.budget,
      token: payerToken,
      result: result.result,
      timestamp: Date.now(),
    });

    this.logger.info("Task completed", { taskId, taskType, worker: worker.address });
    this.setStatus("idle");
  }

  private async findBestWorker(
    taskType: TaskType
  ): Promise<{ id: string; address: string; fee: bigint } | null> {
    const cfg = getConfig();
    const registryAddress = cfg.contracts.workerRegistry;

    if (!registryAddress) {
      return this.findWorkerFromBus(taskType);
    }

    try {
      const activeWorkers = (await this.publicClient.readContract({
        address: registryAddress as `0x${string}`,
        abi: WORKER_REGISTRY_ABI,
        functionName: "getActiveWorkers",
      })) as `0x${string}`[];

      let bestAddress: `0x${string}` | null = null;
      let bestScore = -1n;
      let bestFee = this.budget;

      for (const addr of activeWorkers) {
        const [caps, fee, , isActive] = (await this.publicClient.readContract({
          address: registryAddress as `0x${string}`,
          abi: WORKER_REGISTRY_ABI,
          functionName: "getWorker",
          args: [addr],
        })) as [string[], bigint, string, boolean];

        if (!isActive || !caps.includes(taskType) || fee > this.budget) continue;

        let composite = 0n;
        const oracleAddress = cfg.contracts.reputationOracle;
        if (oracleAddress) {
          try {
            const scoreArr = (await this.publicClient.readContract({
              address: oracleAddress as `0x${string}`,
              abi: REPUTATION_ORACLE_ABI,
              functionName: "getScore",
              args: [addr],
            })) as [bigint, bigint, bigint, bigint, bigint, bigint];
            composite = scoreArr[3];
          } catch {
            composite = 5000n;
          }
        }

        if (composite > bestScore) {
          bestScore = composite;
          bestAddress = addr;
          bestFee = fee;
        }
      }

      if (!bestAddress) return null;
      return { id: bestAddress, address: bestAddress, fee: bestFee };
    } catch {
      return this.findWorkerFromBus(taskType);
    }
  }

  private findWorkerFromBus(
    taskType: TaskType
  ): { id: string; address: string; fee: bigint } | null {
    const agents = messageBus.getRegisteredAgents();
    const workers = agents.filter((id) => id.startsWith("worker-"));
    for (const id of workers) {
      return { id, address: id.replace("worker-", ""), fee: 10000000000000000n };
    }
    return null;
  }

  private buildParams(taskType: TaskType): Record<string, unknown> {
    const POOL = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";
    const WALLETS = [
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      "0xFBEd89164eD414729D180948c05EBa60E56a803d",
    ];
    const TOKENS = [
      "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    ];

    switch (taskType) {
      case "pool-indexer":
        return { poolAddress: POOL, blockRange: 1000 };
      case "wallet-summarizer":
        return {
          walletAddress: WALLETS[Math.floor(Math.random() * WALLETS.length)],
          blockRange: 5000,
        };
      case "token-fact-checker":
        return { tokenAddress: TOKENS[Math.floor(Math.random() * TOKENS.length)] };
    }
  }
}
