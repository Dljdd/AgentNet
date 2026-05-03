// @agentnet/integrations-keeperhub — M-13 (workflow executor) + M-14 (settlement)
//
// KeeperHub is a workflow automation platform that guarantees on-chain execution.
// It retries transactions automatically, handles gas bumps, and surfaces every run
// as a visible, auditable execution in the KeeperHub dashboard.
//
// Two AgentNet workflows are provisioned in the connected KeeperHub organisation:
//
//   agentnet-reputation-update  (lza9g0c0dviu5mu0we7j2)
//     Input : { agentAddress, accuracy, timeliness, uptime }
//     Action: web3/write-contract → ReputationOracle.updateScore() on 0G Galileo (16602)
//
//   agentnet-payment-settle     (qpkwci7tw0dr3dlnjv0d6)
//     Input : { recipientAddress, amount, tokenAddress, tokenSymbol }
//     Action: web3/transfer-token on 0G Galileo (16602)
//
// Both use wallet integration id 2oagpu86f01cbz3kpu5gf.

import type { PaymentReceipt } from "@agentnet/types";

// ─── Workflow IDs ─────────────────────────────────────────────────────────────

/**
 * Stable workflow IDs provisioned in the AgentNet KeeperHub organisation.
 *
 * reputationUpdate — two variants:
 *   sepolia  (gtpk3bflrnoihktuoa8ci) — Ethereum Sepolia, chain 11155111, verified working
 *   0g       (lza9g0c0dviu5mu0we7j2) — 0G Galileo, chain 16602 (Para MPC writes pending KeeperHub support)
 *
 * Default is Sepolia for reliable demo execution; override via env vars.
 */
export const WORKFLOW_IDS = {
  reputationUpdate:
    process.env.KEEPERHUB_REPUTATION_WORKFLOW_ID ?? "gtpk3bflrnoihktuoa8ci",
  paymentSettle:
    process.env.KEEPERHUB_PAYMENT_WORKFLOW_ID ?? "qpkwci7tw0dr3dlnjv0d6",
} as const;

// ─── API response shapes ──────────────────────────────────────────────────────

interface ExecuteWorkflowResponse {
  executionId: string;
  status?: string;
}

interface NodeStatus {
  nodeId: string;
  status: string;
  result?: {
    success?: boolean;
    transactionHash?: string;
    error?: string;
    [key: string]: unknown;
  };
}

interface ExecutionStatusResponse {
  status: "pending" | "running" | "success" | "error";
  nodeStatuses?: NodeStatus[];
  errorContext?: {
    error: string;
    failedNodeId?: string | null;
    lastSuccessfulNodeId?: string | null;
    executionTrace?: string[];
    [key: string]: unknown;
  };
  progress?: {
    totalSteps: number;
    completedSteps: number;
    runningSteps: number;
    percentage: number;
    [key: string]: unknown;
  };
  // Top-level output written by KeeperHub after a successful write-contract or transfer action.
  output?: {
    success?: boolean;
    transactionHash?: string;
    transactionLink?: string;
    [key: string]: unknown;
  };
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface KeeperReceipt {
  executionId: string;
  txHash: string;
  success: boolean;
  executedAt: number;
}

export interface ReputationUpdateParams {
  agentAddress: string;
  accuracy: number;   // 0–10000
  timeliness: number; // 0–10000
  uptime: number;     // 0–10000
}

export interface PaymentSettleParams {
  recipientAddress: string;
  /** Human-readable token amount, e.g. "10.5" */
  amount: string;
  tokenAddress: string;
  tokenSymbol: string;
}

// ─── M-13: KeeperHubClient ────────────────────────────────────────────────────

/**
 * M-13 — Generic KeeperHub workflow executor.
 *
 * Wraps two KeeperHub REST endpoints:
 *   POST /api/workflow/:id/execute                    — launch a workflow with input data
 *   GET  /api/workflows/executions/:id/status         — poll until success or error
 *
 * When KEEPERHUB_API_KEY is absent the client falls back to stub receipts so
 * the rest of the system keeps running during local development.
 */
export class KeeperHubClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(options?: {
    baseUrl?: string;
    apiKey?: string;
    pollIntervalMs?: number;
    timeoutMs?: number;
  }) {
    this.baseUrl =
      options?.baseUrl ??
      process.env.KEEPERHUB_BASE_URL ??
      "https://app.keeperhub.com";
    this.apiKey = options?.apiKey ?? process.env.KEEPERHUB_API_KEY ?? "";
    this.pollIntervalMs = options?.pollIntervalMs ?? 3_000;
    // 0G Galileo testnet can take 3-5 min per tx; 300 s covers typical congestion.
    this.timeoutMs = options?.timeoutMs ?? 300_000;
  }

  /**
   * Trigger a KeeperHub workflow execution with the given input.
   * Returns immediately with the executionId; does not wait for completion.
   */
  async executeWorkflow(
    workflowId: string,
    input: Record<string, unknown>
  ): Promise<{ executionId: string }> {
    if (!this.apiKey) {
      const executionId = `stub-${workflowId}-${Date.now()}`;
      console.warn(`[KeeperHub] No API key — returning stub execution ${executionId}`);
      return { executionId };
    }

    const res = await fetch(
      `${this.baseUrl}/api/workflow/${workflowId}/execute`,
      {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify({ input }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(
        `[KeeperHub] executeWorkflow ${workflowId} failed (${res.status}): ${errBody}`
      );
    }

    const data = (await res.json()) as ExecuteWorkflowResponse;
    return { executionId: data.executionId };
  }

  /**
   * Poll an execution until it reaches a terminal state (success/error)
   * or the configured timeout elapses.
   */
  async waitForExecution(executionId: string): Promise<ExecutionStatusResponse> {
    if (executionId.startsWith("stub-")) {
      // Stub mode: synthesise a successful receipt so callers can continue.
      const fakeTx = `0x${executionId.replace(/[^a-f0-9]/gi, "").padEnd(64, "0").slice(0, 64)}`;
      return {
        status: "success",
        nodeStatuses: [
          { nodeId: "trigger", status: "success" },
          { nodeId: "action", status: "success", result: { success: true, transactionHash: fakeTx } },
        ],
      };
    }

    const deadline = Date.now() + this.timeoutMs;
    let delay = this.pollIntervalMs;

    while (Date.now() < deadline) {
      const res = await fetch(
        `${this.baseUrl}/api/workflows/executions/${executionId}/status`,
        { headers: this.authHeaders() }
      );

      if (res.ok) {
        const data = (await res.json()) as ExecutionStatusResponse;
        if (data.status === "success" || data.status === "error") {
          return data;
        }
      }

      await sleep(delay);
      // Exponential back-off, capped at 15 s.
      delay = Math.min(delay * 1.5, 15_000);
    }

    throw new Error(
      `[KeeperHub] Execution ${executionId} timed out after ${this.timeoutMs}ms`
    );
  }

  /**
   * Execute a workflow and block until it completes. Returns a KeeperReceipt
   * containing the on-chain transaction hash for audit / logging.
   */
  async executeAndWait(
    workflowId: string,
    input: Record<string, unknown>
  ): Promise<KeeperReceipt> {
    const { executionId } = await this.executeWorkflow(workflowId, input);
    const execution = await this.waitForExecution(executionId);

    if (execution.status !== "success") {
      const reason = execution.errorContext?.error ?? "unknown error";
      const isNonceLock = reason.includes("nonce lock");
      throw new Error(
        `[KeeperHub] Workflow ${workflowId} execution ${executionId} failed${isNonceLock ? " (nonce lock — avoid concurrent executions on the same wallet)" : ""}: ${reason}`
      );
    }

    // /status doesn't include the tx hash — fetch it from the full execution record.
    const txHash = await this.fetchExecutionTxHash(executionId);

    return { executionId, txHash, success: true, executedAt: Date.now() };
  }

  /** Fetch the transaction hash from the execution logs endpoint after success. */
  private async fetchExecutionTxHash(executionId: string): Promise<string> {
    if (executionId.startsWith("stub-")) return "";
    try {
      const res = await fetch(
        `${this.baseUrl}/api/workflows/executions/${executionId}/logs`,
        { headers: this.authHeaders() }
      );
      if (!res.ok) return "";
      const data = (await res.json()) as {
        execution?: { output?: { transactionHash?: string } };
        logs?: Array<{ output?: { transactionHash?: string } }>;
      };
      return (
        data.execution?.output?.transactionHash ??
        data.logs?.find((l) => l.output?.transactionHash)?.output?.transactionHash ??
        ""
      );
    } catch {
      return "";
    }
  }

  private authHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }
}

// ─── M-14: KeeperHubSettlement ────────────────────────────────────────────────

/**
 * M-14 — AgentNet-specific settlement helpers built on KeeperHubClient.
 *
 * Every reputation score write and every worker payment flows through here,
 * giving each a KeeperHub executionId for guaranteed on-chain inclusion and a
 * full audit trail visible in the KeeperHub dashboard.
 */
export class KeeperHubSettlement {
  private readonly client: KeeperHubClient;

  constructor(client?: KeeperHubClient) {
    this.client = client ?? new KeeperHubClient();
  }

  /**
   * Write a reputation score to ReputationOracle.updateScore() via KeeperHub.
   * Maps to the `agentnet-reputation-update` workflow (lza9g0c0dviu5mu0we7j2).
   */
  async settleReputationUpdate(params: ReputationUpdateParams): Promise<KeeperReceipt> {
    console.log(
      `[KeeperHub] Reputation update — agent=${params.agentAddress}` +
      ` acc=${params.accuracy} tim=${params.timeliness} upt=${params.uptime}`
    );

    // Score values must be strings; the workflow's web3/write-contract action
    // passes them as uint256 arguments and KeeperHub handles the coercion.
    return this.client.executeAndWait(WORKFLOW_IDS.reputationUpdate, {
      agentAddress: params.agentAddress,
      accuracy: String(params.accuracy),
      timeliness: String(params.timeliness),
      uptime: String(params.uptime),
    });
  }

  /**
   * Settle a worker payment via ERC-20 transfer on 0G Galileo.
   * Maps to the `agentnet-payment-settle` workflow (qpkwci7tw0dr3dlnjv0d6).
   *
   * `amount` should be a human-readable decimal string, e.g. "10.5".
   */
  async settlePayment(params: PaymentSettleParams): Promise<KeeperReceipt> {
    console.log(
      `[KeeperHub] Payment settle — ${params.amount} ${params.tokenSymbol}` +
      ` → ${params.recipientAddress}`
    );

    return this.client.executeAndWait(WORKFLOW_IDS.paymentSettle, {
      recipientAddress: params.recipientAddress,
      amount: params.amount,
      tokenAddress: params.tokenAddress,
      tokenSymbol: params.tokenSymbol,
    });
  }

  /**
   * Derive settlement params from a PaymentReceipt and settle the payment.
   * Assumes 18-decimal output token; use settlePayment() directly for USDC
   * or other non-18-decimal tokens.
   */
  async settleFromReceipt(
    receipt: PaymentReceipt,
    workerAddress: string,
    tokenSymbol?: string
  ): Promise<KeeperReceipt> {
    return this.settlePayment({
      recipientAddress: workerAddress,
      amount: formatTokenAmount(receipt.amountOut, 18),
      tokenAddress: receipt.outputToken,
      tokenSymbol: tokenSymbol ?? receipt.outputToken.slice(2, 8).toUpperCase(),
    });
  }
}

// ─── Singletons ───────────────────────────────────────────────────────────────

export const keeperHub = new KeeperHubClient();
export const keeperHubSettlement = new KeeperHubSettlement(keeperHub);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Convert a raw bigint token amount to a human-readable decimal string. */
function formatTokenAmount(rawAmount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = rawAmount / divisor;
  const fraction = rawAmount % divisor;
  if (fraction === 0n) return whole.toString();
  const fracStr = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}
