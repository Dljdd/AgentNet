// Wallet Summarizer Task — M-16
import { createPublicClient, http, keccak256, toBytes, parseAbiItem, formatEther } from "viem";
import { nanoid } from "nanoid";
import { getConfig } from "@agentnet/config";
import type { TaskResult, WorkProof } from "@agentnet/types";
import { ZGStorage, ZGCompute } from "@agentnet/integrations-0g";

interface WalletSummarizerParams {
  walletAddress: string;
  blockRange?: number;
  maxTransactions?: number;
}

interface WalletStats {
  totalTransactions: number;
  uniqueTokensInteracted: number;
  totalValueTransferred: string;
  mostActiveProtocol: string;
  timeRange: { from: number; to: number };
}

interface WalletSummarizerResult {
  walletAddress: string;
  summary: string;
  stats: WalletStats;
  summarizedAt: number;
}

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

export class WalletSummarizerTask {
  private storageClient: ZGStorage;
  private computeClient: ZGCompute;

  constructor(storageClient: ZGStorage, computeClient: ZGCompute) {
    this.storageClient = storageClient;
    this.computeClient = computeClient;
  }

  async execute(params: WalletSummarizerParams): Promise<TaskResult> {
    const cfg = getConfig();
    const client = createPublicClient({ transport: http(cfg.zgRpcUrl) });

    const blockRange = params.blockRange ?? 1000;
    const maxTransactions = params.maxTransactions ?? 50;
    const wallet = params.walletAddress.toLowerCase() as `0x${string}`;

    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock - BigInt(blockRange);

    // Fetch Transfer logs where wallet is sender (topic1) or receiver (topic2)
    const [sentLogs, receivedLogs] = await Promise.all([
      client.getLogs({
        event: TRANSFER_EVENT,
        fromBlock,
        toBlock: latestBlock,
        args: { from: wallet },
      }),
      client.getLogs({
        event: TRANSFER_EVENT,
        fromBlock,
        toBlock: latestBlock,
        args: { to: wallet },
      }),
    ]);

    const allLogs = [...sentLogs, ...receivedLogs]
      .sort((a, b) => Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n)))
      .slice(0, maxTransactions);

    // Unique token contracts
    const tokenAddresses = new Set(allLogs.map((l) => l.address.toLowerCase()));

    // Tally contract frequency for mostActiveProtocol
    const contractFreq = new Map<string, number>();
    for (const log of allLogs) {
      const addr = log.address.toLowerCase();
      contractFreq.set(addr, (contractFreq.get(addr) ?? 0) + 1);
    }

    let mostActiveProtocol = "EOA transfers";
    let maxFreq = 0;
    for (const [addr, freq] of contractFreq) {
      if (freq > maxFreq) { maxFreq = freq; mostActiveProtocol = addr; }
    }

    // Native value sum (from tx receipts would be ideal; we approximate via log value fields)
    let totalNativeWei = 0n;
    for (const log of allLogs) {
      const args = log.args as { value?: bigint };
      if (args.value) totalNativeWei += args.value;
    }
    const totalValueTransferred = formatEther(totalNativeWei);

    // Block timestamps for time range
    let timeFrom = Date.now();
    let timeTo = Date.now();
    if (allLogs.length > 0) {
      const [firstBlock, lastBlock] = await Promise.all([
        client.getBlock({ blockNumber: allLogs[0].blockNumber ?? latestBlock }),
        client.getBlock({ blockNumber: allLogs[allLogs.length - 1].blockNumber ?? latestBlock }),
      ]);
      timeFrom = Number(firstBlock.timestamp) * 1000;
      timeTo = Number(lastBlock.timestamp) * 1000;
    }

    const stats: WalletStats = {
      totalTransactions: allLogs.length,
      uniqueTokensInteracted: tokenAddresses.size,
      totalValueTransferred,
      mostActiveProtocol,
      timeRange: { from: timeFrom, to: timeTo },
    };

    const fromDate = new Date(timeFrom).toISOString();
    const toDate = new Date(timeTo).toISOString();
    const summaryPrompt =
      `Summarize this Ethereum wallet's recent activity in one paragraph.\n` +
      `Address: ${params.walletAddress}\n` +
      `Transactions: ${stats.totalTransactions}\n` +
      `Unique tokens interacted with: ${stats.uniqueTokensInteracted}\n` +
      `Most active protocol: ${stats.mostActiveProtocol}\n` +
      `Time range: ${fromDate} to ${toDate}\n` +
      `Be concise and informative.`;

    const summary = await this.computeClient.summarize(
      JSON.stringify(stats),
      summaryPrompt
    );

    const result: WalletSummarizerResult = {
      walletAddress: params.walletAddress,
      summary,
      stats,
      summarizedAt: Date.now(),
    };

    await this.storageClient.storeJSON(
      "wallet-summaries",
      `${params.walletAddress}-${Date.now()}`,
      result
    );

    const resultHash = keccak256(toBytes(JSON.stringify(result)));
    const workProof: WorkProof = {
      workerId: "wallet-summarizer",
      taskId: params.walletAddress,
      resultHash,
      timestamp: Date.now(),
    };

    return {
      id: nanoid(),
      taskId: params.walletAddress,
      workerId: "wallet-summarizer",
      result,
      proof: JSON.stringify(workProof),
      timestamp: Date.now(),
    };
  }
}

export default WalletSummarizerTask;
