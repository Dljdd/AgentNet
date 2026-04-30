import { createPublicClient, http, encodeFunctionData } from "viem";
import { AgentBase } from "@agentnet/core";
import { messageBus, createMessage } from "@agentnet/core";
import { getConfig } from "@agentnet/config";
import { ZGStorage, ZGCompute, ZGDA } from "@agentnet/integrations-0g";
import { UniswapSwapClient, PayWithAnyToken } from "@agentnet/integrations-uniswap";
import type { AgentConfig, AgentMessage, TaskType, TaskRequest, TaskResult, WorkProof } from "@agentnet/types";
import { PoolIndexerTask } from "./tasks/pool-indexer";
import { WalletSummarizerTask } from "./tasks/wallet-summarizer";
import { TokenFactCheckerTask } from "./tasks/token-fact-checker";

const WORKER_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "capabilities", type: "string[]" },
      { name: "feePerTask", type: "uint256" },
      { name: "preferredToken", type: "address" },
    ],
    outputs: [],
  },
] as const;

export class WorkerAgent extends AgentBase {
  private capabilities: TaskType[];
  private feePerTask: bigint;
  private preferredToken: string;
  private tasks: Map<string, { execute: (params: unknown) => Promise<TaskResult> }> = new Map();
  private storageClient: ZGStorage;
  private computeClient: ZGCompute;
  private daClient: ZGDA;
  private payWithAnyToken: PayWithAnyToken;
  private heartbeatInterval?: ReturnType<typeof setInterval>;

  constructor(config: AgentConfig & {
    capabilities: TaskType[];
    feePerTask: bigint;
    preferredToken: string;
  }) {
    super(config);
    this.capabilities = config.capabilities;
    this.feePerTask = config.feePerTask;
    this.preferredToken = config.preferredToken;

    const cfg = getConfig();
    this.storageClient = new ZGStorage();
    this.computeClient = new ZGCompute(cfg.zgComputeEndpoint, cfg.privateKey);
    this.daClient = new ZGDA();
    this.payWithAnyToken = new PayWithAnyToken(
      new UniswapSwapClient(cfg.uniswapApiKey, this.wallet)
    );

    type TaskRunner = { execute: (params: unknown) => Promise<TaskResult> };
    this.tasks = new Map<string, TaskRunner>([
      ["pool-indexer", new PoolIndexerTask(this.storageClient, this.computeClient) as unknown as TaskRunner],
      ["wallet-summarizer", new WalletSummarizerTask(this.storageClient, this.computeClient) as unknown as TaskRunner],
      ["token-fact-checker", new TokenFactCheckerTask(this.storageClient, this.computeClient) as unknown as TaskRunner],
    ]);
  }

  async start(): Promise<void> {
    this.startedAt = Date.now();

    const txHash = await this.registerOnChain();
    this.logger.info("Registered on-chain", { txHash });

    await this.storageClient.storeJSON("agent-profiles", this.address, {
      address: this.address,
      capabilities: this.capabilities,
      feePerTask: this.feePerTask.toString(),
      preferredToken: this.preferredToken,
      registeredAt: Date.now(),
    });

    messageBus.register(this.id, (msg) => this.handleMessage(msg));

    this.setStatus("idle");

    this.heartbeatInterval = setInterval(() => {
      messageBus.broadcast(
        createMessage("heartbeat", this.id, "all", {
          address: this.address,
          status: this.status,
          uptime: this.getUptime(),
        })
      );
    }, 30_000);

    this.logger.info("Worker agent started");
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    messageBus.unregister(this.id);
    this.setStatus("offline");
    this.logger.info("Worker agent stopped");
  }

  async handleMessage(message: AgentMessage): Promise<void> {
    if (message.type !== "task-request") return;

    const request = message.payload as TaskRequest;

    if (!this.capabilities.includes(request.type)) {
      messageBus.send(
        createMessage("task-result", this.id, message.from, {
          error: `Unsupported task type: ${request.type}`,
        })
      );
      return;
    }

    if (request.maxFee < this.feePerTask) {
      messageBus.send(
        createMessage("task-result", this.id, message.from, {
          error: `Offered fee ${request.maxFee} is below required ${this.feePerTask}`,
        })
      );
      return;
    }

    this.setStatus("working");

    const challenge = this.payWithAnyToken.createPaymentChallenge({
      workerAddress: this.address,
      amount: this.feePerTask,
      preferredToken: this.preferredToken,
      taskId: request.id,
    });

    messageBus.send(createMessage("payment", this.id, message.from, challenge));

    const result = await this.executeTask(request);
    await this.publishProof(result);

    messageBus.send(createMessage("task-result", this.id, message.from, result));

    this.setStatus("idle");
  }

  private async registerOnChain(): Promise<string> {
    const cfg = getConfig();
    const registryAddress = cfg.contracts.workerRegistry;

    if (!registryAddress) {
      this.logger.warn("WorkerRegistry contract address not configured — skipping on-chain registration");
      return "0x0";
    }

    const data = encodeFunctionData({
      abi: WORKER_REGISTRY_ABI,
      functionName: "register",
      args: [this.capabilities, this.feePerTask, this.preferredToken as `0x${string}`],
    });

    const account = this.wallet.account;
    if (!account) throw new Error("No account on wallet");

    const txHash = await this.wallet.sendTransaction({
      account,
      to: registryAddress as `0x${string}`,
      data,
      chain: this.wallet.chain,
    });

    return txHash;
  }

  private async executeTask(request: TaskRequest): Promise<TaskResult> {
    const taskModule = this.tasks.get(request.type);
    if (!taskModule) {
      throw new Error(`Unsupported task type: ${request.type}`);
    }
    return taskModule.execute(request.params);
  }

  private async publishProof(result: TaskResult): Promise<void> {
    const proof = JSON.parse(result.proof) as WorkProof;
    const { txHash } = await this.daClient.publishWorkProof(proof);
    this.logger.info("Proof published to 0G DA", { txHash });
  }
}
