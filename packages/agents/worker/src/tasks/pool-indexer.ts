// Pool Indexer Task — M-15
import { createPublicClient, http, keccak256, toBytes, parseAbiItem } from "viem";
import { nanoid } from "nanoid";
import { getConfig } from "@agentnet/config";
import type { TaskResult, WorkProof } from "@agentnet/types";
import { ZGStorage } from "@agentnet/integrations-0g";
import type { ZGCompute } from "@agentnet/integrations-0g";

interface PoolIndexerParams {
  poolAddress: string;
  blockRange: number;
  chain?: string;
}

interface SwapEvent {
  txHash: string;
  sender: string;
  amountIn: string;
  amountOut: string;
  timestamp: number;
  blockNumber: number;
}

interface PoolIndexerResult {
  poolAddress: string;
  token0: { address: string; symbol: string };
  token1: { address: string; symbol: string };
  swapCount: number;
  swaps: SwapEvent[];
  totalVolume: { token0: string; token1: string };
  indexedAt: number;
  blockRange: { from: number; to: number };
}

const SWAP_EVENT = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"
);

const ERC20_SYMBOL_ABI = [
  { name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
] as const;

const POOL_TOKEN_ABI = [
  { name: "token0", type: "function", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { name: "token1", type: "function", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
] as const;

export class PoolIndexerTask {
  private storageClient: ZGStorage;
  private computeClient: ZGCompute;

  constructor(storageClient: ZGStorage, computeClient: ZGCompute) {
    this.storageClient = storageClient;
    this.computeClient = computeClient;
  }

  async execute(params: PoolIndexerParams): Promise<TaskResult> {
    const cfg = getConfig();
    const client = createPublicClient({
      transport: http(cfg.zgRpcUrl),
    });

    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock - BigInt(params.blockRange);
    const toBlock = latestBlock;

    const logs = await client.getLogs({
      address: params.poolAddress as `0x${string}`,
      event: SWAP_EVENT,
      fromBlock,
      toBlock,
    });

    // Resolve token addresses and symbols
    let token0Address = "0x0000000000000000000000000000000000000000";
    let token1Address = "0x0000000000000000000000000000000000000000";
    let token0Symbol = "TOKEN0";
    let token1Symbol = "TOKEN1";

    try {
      token0Address = await client.readContract({
        address: params.poolAddress as `0x${string}`,
        abi: POOL_TOKEN_ABI,
        functionName: "token0",
      }) as string;
      token1Address = await client.readContract({
        address: params.poolAddress as `0x${string}`,
        abi: POOL_TOKEN_ABI,
        functionName: "token1",
      }) as string;

      try {
        token0Symbol = await client.readContract({
          address: token0Address as `0x${string}`,
          abi: ERC20_SYMBOL_ABI,
          functionName: "symbol",
        }) as string;
      } catch { /* fallback */ }

      try {
        token1Symbol = await client.readContract({
          address: token1Address as `0x${string}`,
          abi: ERC20_SYMBOL_ABI,
          functionName: "symbol",
        }) as string;
      } catch { /* fallback */ }
    } catch { /* fallback to defaults */ }

    // Parse swap events
    const swaps: SwapEvent[] = [];
    let totalVolume0 = 0n;
    let totalVolume1 = 0n;

    for (const log of logs) {
      const args = log.args as {
        sender?: string;
        amount0?: bigint;
        amount1?: bigint;
      };
      const amount0 = args.amount0 ?? 0n;
      const amount1 = args.amount1 ?? 0n;

      // Positive amount = token flowing into pool (in), negative = out
      const absAmount0 = amount0 < 0n ? -amount0 : amount0;
      const absAmount1 = amount1 < 0n ? -amount1 : amount1;

      totalVolume0 += absAmount0;
      totalVolume1 += absAmount1;

      swaps.push({
        txHash: log.transactionHash ?? "",
        sender: args.sender ?? "",
        amountIn: (amount0 >= 0n ? absAmount0 : absAmount1).toString(),
        amountOut: (amount0 < 0n ? absAmount0 : absAmount1).toString(),
        timestamp: Date.now(),
        blockNumber: Number(log.blockNumber ?? 0n),
      });
    }

    const result: PoolIndexerResult = {
      poolAddress: params.poolAddress,
      token0: { address: token0Address, symbol: token0Symbol },
      token1: { address: token1Address, symbol: token1Symbol },
      swapCount: swaps.length,
      swaps,
      totalVolume: {
        token0: totalVolume0.toString(),
        token1: totalVolume1.toString(),
      },
      indexedAt: Date.now(),
      blockRange: { from: Number(fromBlock), to: Number(toBlock) },
    };

    await this.storageClient.storeJSON(
      "pool-index",
      `${params.poolAddress}-${Date.now()}`,
      result
    );

    const resultHash = keccak256(toBytes(JSON.stringify(result)));
    const workProof: WorkProof = {
      workerId: "pool-indexer",
      taskId: params.poolAddress,
      resultHash,
      timestamp: Date.now(),
    };

    return {
      id: nanoid(),
      taskId: params.poolAddress,
      workerId: "pool-indexer",
      result,
      proof: JSON.stringify(workProof),
      timestamp: Date.now(),
    };
  }

  validate(result: PoolIndexerResult, groundTruth: PoolIndexerResult): number {
    let score = 0;

    if (result.swapCount === groundTruth.swapCount) {
      score += 4000;
    }

    const groundTruthHashes = new Set(groundTruth.swaps.map((s) => s.txHash));
    let matches = 0;
    for (const swap of result.swaps) {
      if (groundTruthHashes.has(swap.txHash)) matches++;
    }

    const maxMatchPoints = 6000;
    const matchScore =
      groundTruth.swaps.length > 0
        ? Math.min(
            Math.floor((matches / groundTruth.swaps.length) * maxMatchPoints),
            maxMatchPoints
          )
        : matches > 0
        ? 0
        : maxMatchPoints;

    score += matchScore;

    return Math.max(0, score);
  }
}

export default PoolIndexerTask;
