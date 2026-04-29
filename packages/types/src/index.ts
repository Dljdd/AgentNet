// @agentnet/types — Shared type definitions

// ---------------------------------------------------------------------------
// Agent types
// ---------------------------------------------------------------------------

/** The role an agent plays in the AgentNet network. */
export type AgentType = "worker" | "reputation" | "client";

/** Static configuration for an AgentNet agent instance. */
export interface AgentConfig {
  id: string;
  type: AgentType;
  wallet: string;
  privateKey: string;
}

/** Runtime lifecycle state of an agent. */
export type AgentStatus = "idle" | "working" | "error" | "offline";

// ---------------------------------------------------------------------------
// Task types
// ---------------------------------------------------------------------------

/** The category of work a worker agent can perform. */
export type TaskType = "pool-indexer" | "wallet-summarizer" | "token-fact-checker";

/** A request submitted by a client agent asking a worker to perform a task. */
export interface TaskRequest {
  id: string;
  type: TaskType;
  params: Record<string, unknown>;
  requester: string;
  maxFee: bigint;
  paymentToken: string;
}

/** The output produced by a worker agent after completing a task. */
export interface TaskResult {
  id: string;
  taskId: string;
  workerId: string;
  result: unknown;
  proof: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Reputation types
// ---------------------------------------------------------------------------

/** Composite reputation metrics for a single worker agent. */
export interface ReputationScore {
  accuracy: number;
  timeliness: number;
  uptime: number;
  composite: number;
  totalJobs: number;
  lastUpdated: number;
}

/** A reputation score update submitted to the on-chain reputation registry. */
export interface ScoreUpdate {
  agentAddress: string;
  score: ReputationScore;
  evidenceUri: string;
}

// ---------------------------------------------------------------------------
// Payment types
// ---------------------------------------------------------------------------

/** A challenge issued by a worker specifying how they want to be paid. */
export interface PaymentChallenge {
  challengeId: string;
  workerAddress: string;
  amount: bigint;
  preferredToken: string;
  taskId: string;
  expiresAt: number;
}

/** Parameters for a cross-token payment routed through the payment module. */
export interface PaymentRequest {
  from: string;
  to: string;
  amount: bigint;
  inputToken: string;
  outputToken: string;
}

/** Confirmation of a settled on-chain payment transaction. */
export interface PaymentReceipt {
  txHash: string;
  from: string;
  to: string;
  amountIn: bigint;
  amountOut: bigint;
  inputToken: string;
  outputToken: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/** The category of a P2P message exchanged between agents. */
export type MessageType =
  | "task-request"
  | "task-result"
  | "payment"
  | "score-update"
  | "heartbeat";

/** A signed envelope wrapping any payload sent between agents over the network. */
export interface AgentMessage<T = unknown> {
  id: string;
  type: MessageType;
  from: string;
  to: string;
  payload: T;
  timestamp: number;
  signature: string;
}

// ---------------------------------------------------------------------------
// 0G types
// ---------------------------------------------------------------------------

/** A key-value record persisted to 0G decentralised storage. */
export interface StorageRecord {
  key: string;
  value: string;
  namespace: string;
}

/** Cryptographic proof that a worker completed a specific task at a point in time. */
export interface WorkProof {
  workerId: string;
  taskId: string;
  resultHash: string;
  timestamp: number;
}

/** An event emitted by the 0G DA layer carrying a work proof. */
export interface DAEvent {
  type: string;
  data: WorkProof;
  blockHeight: number;
}

// ---------------------------------------------------------------------------
// API types (frontend)
// ---------------------------------------------------------------------------

/** Summary of a worker agent as returned by the REST API for list views. */
export interface WorkerListItem {
  address: string;
  status: AgentStatus;
  score: ReputationScore;
  capabilities: TaskType[];
  feePerTask: string;
}

/** A single entry in the network-wide activity feed shown on the dashboard. */
export interface ActivityEvent {
  id: string;
  type: "task" | "payment" | "score";
  summary: string;
  actors: string[];
  timestamp: number;
  txHash?: string;
}
