// Token Fact-Checker Task — M-17
import { createPublicClient, http, keccak256, toBytes, parseAbiItem } from "viem";
import { nanoid } from "nanoid";
import { getConfig } from "@agentnet/config";
import type { TaskResult, WorkProof } from "@agentnet/types";
import { ZGStorage } from "@agentnet/integrations-0g";
import type { ZGCompute } from "@agentnet/integrations-0g";

interface TokenFactCheckerParams {
  tokenAddress: string;
  chain?: string;
}

interface TokenChecks {
  hasVerifiedSource: boolean;
  hasMintFunction: boolean;
  hasBlacklist: boolean;
  hasPausable: boolean;
  liquidityLocked: boolean;
  topHolderConcentration: number;
  contractAge: number;
}

interface TokenFactCheckerResult {
  tokenAddress: string;
  verdict: "legit" | "honeypot" | "rug" | "suspicious" | "unknown";
  confidence: number;
  reasoning: string;
  checks: TokenChecks;
  analyzedAt: number;
}

const ERC20_ABI = [
  { name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { name: "symbol", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
] as const;

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

export class TokenFactCheckerTask {
  private storageClient: ZGStorage;
  private computeClient: ZGCompute;

  constructor(storageClient: ZGStorage, computeClient: ZGCompute) {
    this.storageClient = storageClient;
    this.computeClient = computeClient;
  }

  async execute(params: TokenFactCheckerParams): Promise<TaskResult> {
    const cfg = getConfig();
    const client = createPublicClient({
      transport: http(cfg.zgRpcUrl),
    });

    const address = params.tokenAddress as `0x${string}`;

    // Step 2: Fetch bytecode and check selectors
    let bytecode = "";
    try {
      const raw = await client.getBytecode({ address });
      bytecode = raw ?? "";
    } catch { /* default empty */ }

    const hasMintFunction = bytecode.includes("40c10f19");
    const hasBlacklist = bytecode.includes("44337ea1");
    const hasPausable = bytecode.includes("8456cb59");
    const hasVerifiedSource = false;

    // Step 3: Read token name and symbol
    let _tokenName = "UNKNOWN";
    let _tokenSymbol = "UNKNOWN";
    try {
      _tokenName = await client.readContract({
        address,
        abi: ERC20_ABI,
        functionName: "name",
      }) as string;
    } catch { /* fallback */ }
    try {
      _tokenSymbol = await client.readContract({
        address,
        abi: ERC20_ABI,
        functionName: "symbol",
      }) as string;
    } catch { /* fallback */ }

    // Step 4: Fetch Transfer events
    let contractAge = 0;
    let topHolderConcentration = 0;
    const liquidityLocked = false;

    try {
      const logs = await client.getLogs({
        address,
        event: TRANSFER_EVENT,
        fromBlock: 0n,
        toBlock: "latest",
        // viem getLogs has no built-in limit; we slice after
      });

      const limited = logs.slice(0, 1000);

      if (limited.length > 0) {
        // Earliest block for contractAge
        const earliestBlock = limited[0].blockNumber ?? 0n;
        try {
          const block = await client.getBlock({ blockNumber: earliestBlock });
          const deployTimestamp = Number(block.timestamp);
          contractAge = Math.floor((Date.now() / 1000 - deployTimestamp) / 86400);
        } catch { /* default 0 */ }

        // topHolderConcentration: tally receives per address
        const receiveCounts = new Map<string, number>();
        for (const log of limited) {
          const to = (log.args as { to?: string }).to;
          if (to) {
            receiveCounts.set(to, (receiveCounts.get(to) ?? 0) + 1);
          }
        }

        const sorted = [...receiveCounts.values()].sort((a, b) => b - a);
        const top10Total = sorted.slice(0, 10).reduce((sum, v) => sum + v, 0);
        const grandTotal = sorted.reduce((sum, v) => sum + v, 0);
        topHolderConcentration = grandTotal > 0
          ? Math.round((top10Total / grandTotal) * 100)
          : 0;
      }
    } catch { /* defaults */ }

    const checks: TokenChecks = {
      hasVerifiedSource,
      hasMintFunction,
      hasBlacklist,
      hasPausable,
      liquidityLocked,
      topHolderConcentration,
      contractAge,
    };

    // Step 5: Build fact-check prompt
    const summaryOfChecks =
      `Token ${params.tokenAddress} — ` +
      `mint:${hasMintFunction}, blacklist:${hasBlacklist}, pause:${hasPausable}, ` +
      `concentration:${topHolderConcentration}%, age:${contractAge}d`;

    const prompt =
      `Analyze this token contract for safety.\n` +
      `Address: ${params.tokenAddress}\n` +
      `Has mint function: ${hasMintFunction}\n` +
      `Has blacklist: ${hasBlacklist}\n` +
      `Has pause function: ${hasPausable}\n` +
      `Top 10 holder concentration: ${topHolderConcentration}%\n` +
      `Contract age: ${contractAge} days\n` +
      `Return JSON: { verdict: 'legit'|'honeypot'|'rug'|'suspicious'|'unknown', confidence: 0-100, reasoning: string }`;

    // Step 6: Call computeClient.factCheck and map verdict
    const factCheckResult = await this.computeClient.factCheck(summaryOfChecks, prompt);

    let verdict: TokenFactCheckerResult["verdict"];
    if (factCheckResult.confidence > 70 && hasMintFunction && hasBlacklist) {
      verdict = "honeypot";
    } else if (factCheckResult.verdict === "true") {
      verdict = "legit";
    } else if (factCheckResult.verdict === "false") {
      verdict = "suspicious";
    } else {
      verdict = "unknown";
    }

    // Step 7: Build result
    const result: TokenFactCheckerResult = {
      tokenAddress: params.tokenAddress,
      verdict,
      confidence: factCheckResult.confidence,
      reasoning: factCheckResult.reasoning,
      checks,
      analyzedAt: Date.now(),
    };

    // Step 8: Store in 0G Storage
    await this.storageClient.storeJSON(
      "token-checks",
      `${params.tokenAddress}-${Date.now()}`,
      result
    );

    // Step 9: Build WorkProof
    const resultHash = keccak256(toBytes(JSON.stringify(result)));
    const workProof: WorkProof = {
      workerId: "token-fact-checker",
      taskId: params.tokenAddress,
      resultHash,
      timestamp: Date.now(),
    };

    // Step 10: Return TaskResult
    return {
      id: nanoid(),
      taskId: params.tokenAddress,
      workerId: "token-fact-checker",
      result,
      proof: JSON.stringify(workProof),
      timestamp: Date.now(),
    };
  }
}

export { TokenFactCheckerTask as default };
