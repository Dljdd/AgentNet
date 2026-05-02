// Reputation Scorer — M-20
// Consumes ReputationEvents from the Indexer, maintains an in-memory score
// accumulator per worker, and writes updated scores to ReputationOracle on-chain
// via KeeperHub for guaranteed execution.
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getConfig, ZG_TESTNET } from "@agentnet/config";
import { KeeperHubSettlement } from "@agentnet/integrations-keeperhub";
import type { ReputationEvent } from "./indexer";

const ZG_CHAIN = {
  id: ZG_TESTNET.chainId,
  name: ZG_TESTNET.name,
  nativeCurrency: ZG_TESTNET.nativeCurrency,
  rpcUrls: {
    default: { http: [ZG_TESTNET.rpcUrl] },
    public: { http: [ZG_TESTNET.rpcUrl] },
  },
} as const;

// Used only in the direct-viem fallback path.
const ORACLE_ABI = [
  {
    name: "updateScore",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "accuracy", type: "uint256" },
      { name: "timeliness", type: "uint256" },
      { name: "uptime", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

interface WorkerAccumulator {
  address: string;
  taskCount: number;
  validCount: number;
  totalLatencyMs: number;
  uptimeSamples: number[];
  lastScoredAt: number;
}

export class ReputationScorer {
  private accumulators: Map<string, WorkerAccumulator> = new Map();
  private keeper: KeeperHubSettlement;
  private oracleAddress: string;
  private deployerKey: string;
  private scoreThreshold: number;

  constructor(options?: { scoreThreshold?: number }) {
    const cfg = getConfig();
    this.oracleAddress = cfg.contracts.reputationOracle ?? "";
    this.deployerKey = cfg.privateKey ?? "";
    this.keeper = new KeeperHubSettlement();
    // Write to chain after this many events per worker
    this.scoreThreshold = options?.scoreThreshold ?? 5;
  }

  /** Feed a new event; flushes to chain when threshold is reached. */
  async ingest(event: ReputationEvent): Promise<void> {
    let acc = this.accumulators.get(event.workerAddress);
    if (!acc) {
      acc = {
        address: event.workerAddress,
        taskCount: 0,
        validCount: 0,
        totalLatencyMs: 0,
        uptimeSamples: [],
        lastScoredAt: 0,
      };
      this.accumulators.set(event.workerAddress, acc);
    }

    acc.taskCount += 1;
    if (event.valid) acc.validCount += 1;

    // Proxy latency from timestamp gap (coarse measure)
    const latency = Date.now() - event.timestamp;
    acc.totalLatencyMs += Math.max(0, latency);

    // Uptime sample: 1 if proof arrived within 5 min of task, else 0
    acc.uptimeSamples.push(latency < 300_000 ? 1 : 0);

    if (acc.taskCount % this.scoreThreshold === 0) {
      await this.flush(acc);
    }
  }

  /** Force-write all accumulated scores to chain. */
  async flushAll(): Promise<void> {
    for (const acc of this.accumulators.values()) {
      if (acc.taskCount > 0) await this.flush(acc);
    }
  }

  private computeScores(acc: WorkerAccumulator): { accuracy: bigint; timeliness: bigint; uptime: bigint } {
    const accuracy = acc.taskCount > 0
      ? Math.round((acc.validCount / acc.taskCount) * 10000)
      : 5000;

    // Timeliness: 10000 for < 1s average latency, scaled down
    const avgLatency = acc.taskCount > 0 ? acc.totalLatencyMs / acc.taskCount : 60000;
    const timeliness = Math.max(0, Math.min(10000, Math.round(10000 - (avgLatency / 60000) * 5000)));

    const uptimeAvg = acc.uptimeSamples.length > 0
      ? acc.uptimeSamples.reduce((s, v) => s + v, 0) / acc.uptimeSamples.length
      : 0.5;
    const uptime = Math.round(uptimeAvg * 10000);

    return { accuracy: BigInt(accuracy), timeliness: BigInt(timeliness), uptime: BigInt(uptime) };
  }

  private async flush(acc: WorkerAccumulator): Promise<void> {
    if (!this.oracleAddress || !this.deployerKey) return;

    const { accuracy, timeliness, uptime } = this.computeScores(acc);

    try {
      // Primary path: submit via KeeperHub workflow for guaranteed execution.
      await this.keeper.settleReputationUpdate({
        agentAddress: acc.address,
        accuracy: Number(accuracy),
        timeliness: Number(timeliness),
        uptime: Number(uptime),
      });
      acc.lastScoredAt = Date.now();
    } catch (err) {
      // Fallback: write directly via viem if KeeperHub is unavailable.
      try {
        const account = privateKeyToAccount(this.deployerKey as `0x${string}`);
        const wallet = createWalletClient({ account, chain: ZG_CHAIN, transport: http(ZG_TESTNET.rpcUrl) });
        await wallet.writeContract({
          address: this.oracleAddress as `0x${string}`,
          abi: ORACLE_ABI,
          functionName: "updateScore",
          args: [acc.address as `0x${string}`, accuracy, timeliness, uptime],
          account,
        });
        acc.lastScoredAt = Date.now();
      } catch {
        console.warn(`[Scorer] Failed to write score for ${acc.address}:`, err);
      }
    }
  }
}
