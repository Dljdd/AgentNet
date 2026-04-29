# AgentNet v3 — Implementation Plan

> **A swarm of AI agents that get paid by anyone, in any token, for doing onchain work — building their own reputation onchain in the process.**

This document breaks AgentNet into **fine-grained, independently buildable modules**. Each module is scoped to 1–2 files, has explicit inputs/outputs, and includes a ready-to-use prompt for a standalone coding agent. Modules are organized into **layers** — build bottom-up.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Module Dependency Graph](#3-module-dependency-graph)
4. [Layer 0 — Project Foundation](#4-layer-0--project-foundation)
5. [Layer 1 — Smart Contracts](#5-layer-1--smart-contracts)
6. [Layer 2 — Core SDK & Shared Libraries](#6-layer-2--core-sdk--shared-libraries)
7. [Layer 3 — 0G Integration Layer](#7-layer-3--0g-integration-layer)
8. [Layer 4 — Uniswap Integration Layer](#8-layer-4--uniswap-integration-layer)
9. [Layer 5 — KeeperHub Integration Layer](#9-layer-5--keeperhub-integration-layer)
10. [Layer 6 — Worker Agents](#10-layer-6--worker-agents)
11. [Layer 7 — Reputation Agent](#11-layer-7--reputation-agent)
12. [Layer 8 — Client Agents](#12-layer-8--client-agents)
13. [Layer 9 — MCP Server](#13-layer-9--mcp-server)
14. [Layer 10 — Frontend Explorer](#14-layer-10--frontend-explorer)
15. [Layer 11 — Orchestration & Demo](#15-layer-11--orchestration--demo)
16. [Layer 12 — Submission Deliverables](#16-layer-12--submission-deliverables)
17. [Build Order & Parallelism Map](#17-build-order--parallelism-map)
18. [Coding Agent Prompt Templates](#18-coding-agent-prompt-templates)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND EXPLORER                        │
│   Worker List · Score Timeline · Activity Feed · Worker Selector│
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST / WebSocket
┌──────────────────────────────▼──────────────────────────────────┐
│                         MCP SERVER / API                        │
│          Exposes Workers as MCP-callable tools + REST API        │
└───┬──────────────┬───────────────┬──────────────┬───────────────┘
    │              │               │              │
┌───▼───┐    ┌─────▼─────┐   ┌────▼────┐   ┌────▼────┐
│Client │    │  Worker    │   │Reputation│   │  Seed   │
│Agents │    │  Agents    │   │  Agent   │   │ Script  │
│(demo) │    │(3 types)   │   │(1 agent) │   │         │
└───┬───┘    └─────┬──────┘   └────┬─────┘   └─────────┘
    │              │               │
    │    ┌─────────▼───────────┐   │
    │    │   CORE SDK LAYER    │   │
    │    │ Agent Base · Config │   │
    │    │ Messaging · Types   │   │
    │    └──┬──────┬───────┬───┘   │
    │       │      │       │       │
┌───▼───┐ ┌▼──────▼┐ ┌────▼───┐ ┌─▼──────────┐
│Uniswap│ │  0G     │ │Keeper- │ │  Smart     │
│Layer  │ │  Layer  │ │Hub Lyr │ │  Contracts │
│       │ │Stor/Comp│ │        │ │  (0G Chain)│
└───────┘ └─────────┘ └────────┘ └────────────┘
```

### The 3 Agent Types
- **Worker Agents** — Do real onchain work (index pools, summarize wallets, fact-check tokens), get paid
- **Reputation Agent** — Watches Worker output, scores accuracy/timeliness, publishes scores onchain
- **Client Agents** — Simulated end-users that buy Worker output, pay in random tokens

### Sponsor Integrations (all load-bearing)
- **0G** — Storage (KV + Log), Compute (LLM inference), DA (work-proof broadcast)
- **Uniswap** — pay-with-any-token via `uniswap-trading` plugin (x402/MPP)
- **KeeperHub** — Guaranteed tx execution for every reputation write and payment settlement

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (Node.js 20+) |
| Package Manager | pnpm (monorepo with workspaces) |
| Smart Contracts | Solidity 0.8.x, Hardhat |
| Chain | 0G Chain Testnet |
| Frontend | Next.js 14 (App Router), TailwindCSS, Recharts |
| Agent Framework | Custom lightweight harness (no heavy framework) |
| Blockchain Interaction | viem, wagmi (via uniswap-viem plugin) |
| Testing | Vitest (unit), Hardhat tests (contracts) |
| Monorepo Structure | Turborepo |

---

## 3. Module Dependency Graph

Modules are numbered `M-XX`. Build order follows layer numbers — all modules in the same layer can be built in parallel.

```
LAYER 0:  M-01 (Monorepo Setup)
              │
LAYER 1:  M-02 (Reputation Oracle) ── M-03 (Worker Registry)
              │                            │
LAYER 2:  M-04 (Types) ─ M-05 (Config) ─ M-06 (Agent Base) ─ M-07 (Messaging)
              │               │               │                   │
LAYER 3:  M-08 (0G Storage) ── M-09 (0G Compute) ── M-10 (0G DA)
              │                    │                     │
LAYER 4:  M-11 (Uniswap Swap) ── M-12 (Pay-With-Any-Token)
              │                       │
LAYER 5:  M-13 (KeeperHub TX) ── M-14 (KeeperHub Settlement)
              │                       │
LAYER 6:  M-15 (Pool Indexer) ── M-16 (Wallet Summarizer) ── M-17 (Token Fact-Checker)
              │                       │                           │
LAYER 7:  M-18 (Rep Indexer) ── M-19 (Rep Scorer) ── M-20 (Rep Watchdog)
              │
LAYER 8:  M-21 (Client Agent)
              │
LAYER 9:  M-22 (MCP Server)
              │
LAYER 10: M-23 (API Server) ── M-24 (Worker List UI) ── M-25 (Score Timeline UI)
          M-26 (Activity Feed UI) ── M-27 (Worker Selector UI)
              │
LAYER 11: M-28 (Cold-Start Seed) ── M-29 (Orchestrator) ── M-30 (Demo Script)
              │
LAYER 12: M-31 (README + Arch Diagram) ── M-32 (FEEDBACK.md) ── M-33 (KEEPERHUB_FEEDBACK.md)
          M-34 (Demo Video Script)
```

---

## 4. Layer 0 — Project Foundation

### M-01: Monorepo Scaffold

**Files:** `package.json`, `turbo.json`, `tsconfig.base.json`, `.env.example`, `.gitignore`

**Description:** Initialize a pnpm monorepo with Turborepo. Create workspace packages:

```
agentnet/
├── packages/
│   ├── contracts/        # Solidity smart contracts (Hardhat)
│   ├── types/            # Shared TypeScript types & interfaces
│   ├── config/           # Environment config & chain constants
│   ├── core/             # Agent base class, messaging protocol
│   ├── integrations/
│   │   ├── 0g/           # 0G Storage, Compute, DA wrappers
│   │   ├── uniswap/      # Swap + pay-with-any-token
│   │   └── keeperhub/    # TX submission + settlement
│   ├── agents/
│   │   ├── worker/       # Worker agent + 3 task modules
│   │   ├── reputation/   # Reputation agent (indexer, scorer, watchdog)
│   │   └── client/       # Client agent (demo seed)
│   ├── mcp-server/       # MCP server exposing workers as tools
│   └── frontend/         # Next.js explorer UI
├── scripts/              # Seed, orchestrate, demo
├── turbo.json
├── package.json
├── .env.example
└── README.md
```

**Coding Agent Prompt:**
```
Create a pnpm monorepo with Turborepo for a project called "agentnet".

Structure the monorepo with these workspace packages:
- packages/contracts (Hardhat + Solidity project)
- packages/types (shared TypeScript types, no dependencies)
- packages/config (env config loader, depends on types)
- packages/core (agent base class + messaging, depends on types + config)
- packages/integrations/0g (depends on core)
- packages/integrations/uniswap (depends on core)
- packages/integrations/keeperhub (depends on core)
- packages/agents/worker (depends on core + all integrations)
- packages/agents/reputation (depends on core + integrations/0g + integrations/keeperhub)
- packages/agents/client (depends on core + integrations/uniswap)
- packages/mcp-server (depends on core + agents/worker)
- packages/frontend (Next.js 14 app, depends on types)
- scripts/ (top-level scripts directory)

Each package should have its own package.json, tsconfig.json (extending
a root tsconfig.base.json), and an src/index.ts entry point.

Use TypeScript 5.x, target ES2022, module NodeNext.
Add vitest as the test runner for all packages.
Create a root .env.example with placeholders for:
  PRIVATE_KEY, 0G_RPC_URL, 0G_STORAGE_ENDPOINT, 0G_COMPUTE_ENDPOINT,
  0G_DA_ENDPOINT, UNISWAP_API_KEY, KEEPERHUB_API_KEY, CHAIN_ID

Do NOT add any business logic — just the scaffold with empty index.ts
files and proper cross-package references.
```

---

## 5. Layer 1 — Smart Contracts

### M-02: Reputation Oracle Contract

**Files:** `packages/contracts/contracts/ReputationOracle.sol`, `packages/contracts/test/ReputationOracle.test.ts`

**Description:** Solidity contract that stores and exposes agent reputation scores. Only authorized updaters (the Reputation Agent's address, submitted via KeeperHub) can write scores.

**Interface:**
```solidity
struct AgentScore {
    uint256 accuracy;      // 0-10000 (basis points)
    uint256 timeliness;    // 0-10000
    uint256 uptime;        // 0-10000
    uint256 composite;     // weighted average
    uint256 totalJobs;
    uint256 lastUpdated;
}

function updateScore(address agent, uint256 accuracy, uint256 timeliness, uint256 uptime) external onlyAuthorized;
function getScore(address agent) external view returns (AgentScore memory);
function getTopAgents(uint256 count) external view returns (address[] memory, AgentScore[] memory);
function setAuthorizedUpdater(address updater, bool authorized) external onlyOwner;

event ScoreUpdated(address indexed agent, uint256 composite, uint256 timestamp);
```

**Coding Agent Prompt:**
```
Write a Solidity 0.8.20+ smart contract called ReputationOracle that
stores reputation scores for AI agents on the 0G Chain.

Requirements:
1. Store AgentScore structs mapped by agent address. Each score has:
   accuracy (0-10000 bps), timeliness (0-10000), uptime (0-10000),
   composite (weighted: 50% accuracy, 30% timeliness, 20% uptime),
   totalJobs counter, and lastUpdated timestamp.

2. updateScore(address agent, uint256 accuracy, uint256 timeliness,
   uint256 uptime) — callable only by authorized addresses. Auto-
   calculates composite. Increments totalJobs. Emits ScoreUpdated.

3. getScore(address) — public view returning the full AgentScore.

4. getTopAgents(uint256 count) — returns the top N agents by composite
   score. Use a simple sorted insertion (max 100 agents expected).

5. setAuthorizedUpdater(address, bool) — onlyOwner.

6. Use OpenZeppelin Ownable for ownership.

Write comprehensive Hardhat tests in TypeScript covering:
- Authorized vs unauthorized updates
- Score calculation correctness
- Top agents ranking
- Edge cases (zero scores, same agent updated twice)

File: contracts/ReputationOracle.sol
Test: test/ReputationOracle.test.ts
```

---

### M-03: Worker Registry Contract

**Files:** `packages/contracts/contracts/WorkerRegistry.sol`, `packages/contracts/test/WorkerRegistry.test.ts`

**Description:** On-chain registry where Worker agents register themselves with metadata (capabilities, fee, wallet address). Used by Clients to discover Workers.

**Interface:**
```solidity
struct WorkerInfo {
    address wallet;
    string metadataUri;    // points to 0G Storage for full profile
    uint256 feePerTask;    // in wei
    string[] capabilities; // e.g., ["pool-indexer", "wallet-summarizer"]
    bool active;
    uint256 registeredAt;
}

function register(string calldata metadataUri, uint256 feePerTask, string[] calldata capabilities) external;
function deactivate() external;
function getWorker(address wallet) external view returns (WorkerInfo memory);
function getActiveWorkers() external view returns (address[] memory);

event WorkerRegistered(address indexed wallet, string metadataUri);
event WorkerDeactivated(address indexed wallet);
```

**Coding Agent Prompt:**
```
Write a Solidity 0.8.20+ smart contract called WorkerRegistry for
registering AI worker agents on the 0G Chain.

Requirements:
1. Store WorkerInfo structs mapped by wallet address. Fields:
   wallet, metadataUri (string, points to 0G Storage), feePerTask
   (uint256 in wei), capabilities (string array), active (bool),
   registeredAt (timestamp).

2. register(metadataUri, feePerTask, capabilities) — any address
   can register once. Sets active=true. Emits WorkerRegistered.

3. updateFee(uint256 newFee) — registered workers can update fee.

4. deactivate() — registered worker sets active=false. Emits event.

5. getWorker(address) — public view, returns full WorkerInfo.

6. getActiveWorkers() — returns array of active worker addresses.

7. getWorkersByCapability(string capability) — returns addresses
   of active workers that have the given capability.

Write Hardhat tests covering registration, deactivation, queries,
duplicate registration prevention, and capability filtering.

File: contracts/WorkerRegistry.sol
Test: test/WorkerRegistry.test.ts
```

---

## 6. Layer 2 — Core SDK & Shared Libraries

### M-04: Shared Types

**Files:** `packages/types/src/index.ts`

**Description:** All shared TypeScript interfaces and types used across the monorepo. No runtime dependencies.

**Coding Agent Prompt:**
```
Create a TypeScript types package for the AgentNet project. This
package has ZERO runtime dependencies — only type definitions.

Define the following types/interfaces in packages/types/src/index.ts:

1. Agent types:
   - AgentType = "worker" | "reputation" | "client"
   - AgentConfig { id: string; type: AgentType; wallet: string; privateKey: string; }
   - AgentStatus = "idle" | "working" | "error" | "offline"

2. Task types:
   - TaskType = "pool-indexer" | "wallet-summarizer" | "token-fact-checker"
   - TaskRequest { id: string; type: TaskType; params: Record<string, unknown>; requester: string; maxFee: bigint; paymentToken: string; }
   - TaskResult { id: string; taskId: string; workerId: string; result: unknown; proof: string; timestamp: number; }

3. Reputation types:
   - ReputationScore { accuracy: number; timeliness: number; uptime: number; composite: number; totalJobs: number; lastUpdated: number; }
   - ScoreUpdate { agentAddress: string; score: ReputationScore; evidenceUri: string; }

4. Payment types:
   - PaymentRequest { from: string; to: string; amount: bigint; inputToken: string; outputToken: string; }
   - PaymentReceipt { txHash: string; from: string; to: string; amountIn: bigint; amountOut: bigint; inputToken: string; outputToken: string; timestamp: number; }

5. Message types:
   - MessageType = "task-request" | "task-result" | "payment" | "score-update" | "heartbeat"
   - AgentMessage<T = unknown> { id: string; type: MessageType; from: string; to: string; payload: T; timestamp: number; signature: string; }

6. 0G types:
   - StorageRecord { key: string; value: string; namespace: string; }
   - WorkProof { workerId: string; taskId: string; resultHash: string; timestamp: number; }
   - DAEvent { type: string; data: WorkProof; blockHeight: number; }

7. API types (for frontend):
   - WorkerListItem { address: string; status: AgentStatus; score: ReputationScore; capabilities: TaskType[]; feePerTask: string; }
   - ActivityEvent { id: string; type: "task" | "payment" | "score"; summary: string; actors: string[]; timestamp: number; txHash?: string; }

Export everything. Add JSDoc comments on each type.
```

---

### M-05: Configuration Manager

**Files:** `packages/config/src/index.ts`, `packages/config/src/chains.ts`

**Description:** Loads and validates environment variables, exports chain constants and contract addresses.

**Coding Agent Prompt:**
```
Create a configuration package for the AgentNet project.

File 1: packages/config/src/chains.ts
- Export chain configuration for 0G Chain Testnet:
  { chainId, name, rpcUrl, blockExplorerUrl, nativeCurrency }
- Export known contract addresses (initially empty, filled after deploy):
  { reputationOracle: string; workerRegistry: string; }
- Export known token addresses for testnet:
  { USDC, WETH, USDT } (use placeholder addresses)

File 2: packages/config/src/index.ts
- Use dotenv to load .env file
- Export a getConfig() function that returns a validated config object:
  {
    privateKey: string;
    zgRpcUrl: string;
    zgStorageEndpoint: string;
    zgComputeEndpoint: string;
    zgDAEndpoint: string;
    uniswapApiKey: string;
    keeperHubApiKey: string;
    chainId: number;
    contracts: { reputationOracle: string; workerRegistry: string; };
  }
- Throw descriptive errors if required env vars are missing
- Export the chain config from chains.ts

Dependencies: dotenv, zod (for validation).
Import types from @agentnet/types.
```

---

### M-06: Agent Base Class

**Files:** `packages/core/src/agent-base.ts`

**Description:** Abstract base class that all agents (Worker, Reputation, Client) extend. Handles lifecycle, wallet management, logging, and health reporting.

**Coding Agent Prompt:**
```
Create an abstract Agent base class in TypeScript for the AgentNet
project. All agent types (Worker, Reputation, Client) will extend this.

File: packages/core/src/agent-base.ts

Requirements:
1. Import AgentConfig, AgentStatus, AgentType from @agentnet/types
2. Import getConfig from @agentnet/config

3. Abstract class AgentBase:
   Properties:
   - id: string (unique agent identifier)
   - type: AgentType
   - status: AgentStatus (starts as "idle")
   - wallet: viem WalletClient (created from privateKey in config)
   - address: string (derived from wallet)
   - logger: a simple structured logger (console-based, with agent id prefix)
   - startedAt: number (timestamp)

   Constructor(config: AgentConfig):
   - Initialize wallet from config.privateKey using viem
   - Set up logger with agent ID prefix

   Abstract methods (subclasses must implement):
   - start(): Promise<void> — begin agent's main loop
   - stop(): Promise<void> — graceful shutdown
   - handleMessage(message: AgentMessage): Promise<void> — process incoming

   Concrete methods:
   - getStatus(): AgentStatus
   - setStatus(status: AgentStatus): void — updates + logs
   - getUptime(): number — seconds since start
   - toJSON(): serializable representation for API/UI
   - sign(data: string): Promise<string> — sign with wallet
   - verify(data: string, signature: string, address: string): boolean

4. Use viem for wallet operations (createWalletClient, privateKeyToAccount)
5. Export the class as default and named export

Dependencies: viem
```

---

### M-07: Agent Messaging Protocol

**Files:** `packages/core/src/messaging.ts`, `packages/core/src/message-bus.ts`

**Description:** In-process message bus for agent-to-agent communication. Messages are typed, signed, and routed by agent ID. In production this would be over a network; for the hackathon demo, an in-process EventEmitter is sufficient.

**Coding Agent Prompt:**
```
Create an agent messaging system for the AgentNet project.

File 1: packages/core/src/messaging.ts
- Import AgentMessage, MessageType from @agentnet/types
- createMessage<T>(type, from, to, payload): AgentMessage<T>
  — generates unique id (nanoid), adds timestamp, empty signature
- signMessage(message, privateKey): AgentMessage — fills in signature
  using viem's signMessage
- verifyMessage(message): boolean — verifies signature matches "from"

File 2: packages/core/src/message-bus.ts
- Class MessageBus (singleton pattern):
  - Uses Node.js EventEmitter internally
  - register(agentId: string, handler: (msg: AgentMessage) => void)
    — subscribes the agent to messages addressed to it
  - unregister(agentId: string) — removes subscription
  - send(message: AgentMessage): void
    — emits to the target agent's handler
    — also emits on a global "all" channel (for monitoring/logging)
  - broadcast(message: AgentMessage): void
    — sends to ALL registered agents
  - onAny(handler: (msg: AgentMessage) => void)
    — subscribe to all messages (for the activity feed)
  - getRegisteredAgents(): string[]

- Export a singleton instance: export const messageBus = MessageBus.getInstance()

Dependencies: viem, nanoid
```

---

## 7. Layer 3 — 0G Integration Layer

### M-08: 0G Storage Client

**Files:** `packages/integrations/0g/src/storage.ts`

**Description:** Wrapper around 0G Storage SDK for key-value and log storage. Workers use this to store work history, payment receipts, and task results.

**Coding Agent Prompt:**
```
Create a 0G Storage wrapper for the AgentNet project.

File: packages/integrations/0g/src/storage.ts

This wraps the 0G Storage SDK (@0glabs/0g-ts-sdk) to provide a
simple key-value and log interface for AI agents.

Class ZGStorage:
  constructor(endpoint: string, privateKey: string)
  - Initialize 0G storage client using the SDK

  Key-Value Operations:
  - put(namespace: string, key: string, value: string): Promise<string>
    — stores a value, returns the transaction hash
    — namespace examples: "work-history", "payment-receipts"
  - get(namespace: string, key: string): Promise<string | null>
    — retrieves a value by key
  - list(namespace: string, prefix?: string): Promise<StorageRecord[]>
    — lists all records in a namespace, optionally filtered by prefix

  Log Operations:
  - appendLog(logName: string, data: string): Promise<string>
    — appends an entry to a named log stream
  - readLog(logName: string, fromIndex?: number): Promise<string[]>
    — reads log entries from the given index

  Utility:
  - storeJSON<T>(namespace: string, key: string, data: T): Promise<string>
    — JSON.stringify + put
  - getJSON<T>(namespace: string, key: string): Promise<T | null>
    — get + JSON.parse

Import StorageRecord from @agentnet/types.
Import getConfig from @agentnet/config for endpoint defaults.

If the 0G SDK is not yet available or has a different API shape,
create the wrapper with TODO comments marking where the actual SDK
calls go, and use a mock in-memory implementation as fallback.

Dependencies: @0glabs/0g-ts-sdk (or mock)
```

---

### M-09: 0G Compute Client

**Files:** `packages/integrations/0g/src/compute.ts`

**Description:** Wrapper around 0G Compute for running LLM inference. The Reputation Agent uses this for scoring, Workers use it for task execution.

**Coding Agent Prompt:**
```
Create a 0G Compute wrapper for the AgentNet project.

File: packages/integrations/0g/src/compute.ts

This wraps the 0G Compute Network to run LLM inference for agent
tasks (scoring, summarization, fact-checking).

Class ZGCompute:
  constructor(endpoint: string, privateKey: string)

  Methods:
  - inference(prompt: string, options?: {
      model?: string;        // default: "meta-llama/Meta-Llama-3.1-8B-Instruct"
      maxTokens?: number;    // default: 1024
      temperature?: number;  // default: 0.1
    }): Promise<string>
    — sends a prompt to 0G Compute, returns the completion text

  - scoringInference(workerOutput: string, groundTruth: string): Promise<{
      accuracy: number;      // 0-10000
      explanation: string;
    }>
    — specialized method for the Reputation Agent
    — constructs a scoring prompt that compares worker output to ground truth
    — parses the LLM response into a numeric score + explanation

  - summarize(data: string, instructions: string): Promise<string>
    — general summarization helper

  - factCheck(claim: string, evidence: string): Promise<{
      verdict: "true" | "false" | "unverifiable";
      confidence: number;
      reasoning: string;
    }>
    — fact-checking helper for the Token Fact-Checker worker

If the 0G Compute SDK isn't available, implement with HTTP fetch
calls to the 0G Compute endpoint (it's a standard OpenAI-compatible
API). Include a mock fallback for testing.

Dependencies: @0glabs/0g-ts-sdk (or fetch-based)
```

---

### M-10: 0G DA (Data Availability) Client

**Files:** `packages/integrations/0g/src/da.ts`

**Description:** Publishes work proofs to 0G DA so anyone can subscribe and audit. The Reputation Agent subscribes to work-proof events.

**Coding Agent Prompt:**
```
Create a 0G Data Availability (DA) wrapper for the AgentNet project.

File: packages/integrations/0g/src/da.ts

This wraps 0G DA for publishing and subscribing to work-proof events.
Workers publish proofs after completing tasks; the Reputation Agent
subscribes to verify and score them.

Class ZGDA:
  constructor(endpoint: string, privateKey: string)

  Publishing:
  - publishWorkProof(proof: WorkProof): Promise<{ txHash: string; blockHeight: number }>
    — serializes the WorkProof and submits to 0G DA
    — returns the transaction hash and block height

  - publishBatch(proofs: WorkProof[]): Promise<{ txHash: string; blockHeight: number }>
    — batch publish for efficiency

  Subscribing:
  - subscribe(callback: (event: DAEvent) => void): () => void
    — subscribes to new DA events (work proofs)
    — returns an unsubscribe function
    — callback receives parsed DAEvent objects

  - getEvents(fromBlock: number, toBlock?: number): Promise<DAEvent[]>
    — queries historical DA events in a block range

  Utility:
  - getLatestBlock(): Promise<number>
  - verifyProof(proof: WorkProof, txHash: string): Promise<boolean>

Import WorkProof, DAEvent from @agentnet/types.

If the 0G DA SDK isn't available, implement using HTTP/WebSocket
calls to the DA endpoint. Include a mock EventEmitter-based fallback.

Dependencies: @0glabs/0g-ts-sdk (or WebSocket + fetch)
```

---

## 8. Layer 4 — Uniswap Integration Layer

### M-11: Uniswap Swap Client

**Files:** `packages/integrations/uniswap/src/swap.ts`

**Description:** Wraps the Uniswap Trading API for executing token swaps. Used as the building block for pay-with-any-token.

**Coding Agent Prompt:**
```
Create a Uniswap swap integration for the AgentNet project.

File: packages/integrations/uniswap/src/swap.ts

This wraps the Uniswap Trading API (not the SDK directly) for
executing token swaps on behalf of agents.

Class UniswapSwapClient:
  constructor(apiKey: string, walletClient: WalletClient)

  Methods:
  - getQuote(params: {
      tokenIn: string;       // token address
      tokenOut: string;      // token address
      amount: bigint;        // amount in smallest unit
      type: "EXACT_INPUT" | "EXACT_OUTPUT";
    }): Promise<{
      quote: bigint;
      route: unknown;        // opaque route object for execution
      priceImpact: number;
      gasEstimate: bigint;
    }>
    — fetches a quote from Uniswap Trading API

  - executeSwap(params: {
      tokenIn: string;
      tokenOut: string;
      amount: bigint;
      type: "EXACT_INPUT" | "EXACT_OUTPUT";
      slippageTolerance?: number;  // default 0.5%
      recipient?: string;
    }): Promise<{
      txHash: string;
      amountIn: bigint;
      amountOut: bigint;
    }>
    — gets quote, signs, and submits the swap transaction

  - getSupportedTokens(): Promise<{ address: string; symbol: string; decimals: number }[]>

Use the Uniswap Trading API endpoint:
  POST https://trading-api.gateway.uniswap.org/v1/quote
  POST https://trading-api.gateway.uniswap.org/v1/swap

Use viem for transaction signing and submission.
Include error handling for insufficient balance, high slippage, etc.

Dependencies: viem
```

---

### M-12: Pay-With-Any-Token (x402/MPP)

**Files:** `packages/integrations/uniswap/src/pay-with-any-token.ts`

**Description:** Implements the x402 / Micropayment Protocol flow where a Client pays a Worker in any token, and Uniswap swaps it to the Worker's preferred token in-flight.

**Coding Agent Prompt:**
```
Create a pay-with-any-token module for the AgentNet project.

File: packages/integrations/uniswap/src/pay-with-any-token.ts

This implements the x402 / MPP (Micropayment Protocol) flow:
1. Worker issues an x402 challenge (HTTP 402 + payment requirements)
2. Client holds Token A, Worker wants Token B
3. Client pays in Token A → Uniswap swaps to Token B in-flight →
   Worker receives Token B

Class PayWithAnyToken:
  constructor(swapClient: UniswapSwapClient)

  Methods:
  - createPaymentChallenge(params: {
      workerAddress: string;
      amount: bigint;
      preferredToken: string;  // Worker's preferred token address
      taskId: string;
    }): PaymentChallenge
    — Worker calls this to create an x402 challenge

  - fulfillChallenge(params: {
      challenge: PaymentChallenge;
      payerToken: string;    // token the Client holds
      payerWallet: WalletClient;
    }): Promise<PaymentReceipt>
    — Client calls this to pay
    — If payerToken === challenge.preferredToken, direct transfer
    — Otherwise, swap via UniswapSwapClient then transfer
    — Returns a PaymentReceipt

  - verifyPayment(receipt: PaymentReceipt): Promise<boolean>
    — Verify on-chain that payment was received

Types needed (add to @agentnet/types if not present):
  PaymentChallenge {
    challengeId: string;
    workerAddress: string;
    amount: bigint;
    preferredToken: string;
    taskId: string;
    expiresAt: number;
  }

Import PaymentReceipt from @agentnet/types.
Import UniswapSwapClient from ./swap.

Dependencies: viem, UniswapSwapClient (from M-11)
```

---

## 9. Layer 5 — KeeperHub Integration Layer

### M-13: KeeperHub Transaction Submitter

**Files:** `packages/integrations/keeperhub/src/tx-submitter.ts`

**Description:** Wraps KeeperHub's API for guaranteed transaction execution. Every reputation write and critical payment goes through KeeperHub to ensure it lands on-chain.

**Coding Agent Prompt:**
```
Create a KeeperHub transaction submission wrapper for AgentNet.

File: packages/integrations/keeperhub/src/tx-submitter.ts

KeeperHub guarantees transaction inclusion — no failed txs, no
gas management needed by agents. This wraps their API.

Class KeeperHubTx:
  constructor(apiKey: string, chainId: number)

  Methods:
  - submitTransaction(params: {
      to: string;            // contract address
      data: string;          // encoded calldata
      value?: bigint;        // ETH value (default 0)
      gasLimit?: number;     // optional override
      priority?: "low" | "medium" | "high";
    }): Promise<{
      keeperHubId: string;   // KeeperHub's tracking ID
      txHash: string;        // on-chain tx hash (once mined)
      status: "pending" | "submitted" | "confirmed" | "failed";
    }>
    — submits a transaction through KeeperHub
    — polls until confirmed or failed

  - getTransactionStatus(keeperHubId: string): Promise<{
      status: "pending" | "submitted" | "confirmed" | "failed";
      txHash?: string;
      blockNumber?: number;
      error?: string;
    }>

  - submitContractCall(params: {
      contractAddress: string;
      abi: any[];
      functionName: string;
      args: any[];
      value?: bigint;
    }): Promise<{ keeperHubId: string; txHash: string; status: string }>
    — convenience method: encodes the call + submits

  - batchSubmit(calls: Array<{
      to: string; data: string; value?: bigint;
    }>): Promise<Array<{ keeperHubId: string; txHash: string }>>

Use fetch() to call the KeeperHub REST API.
Base URL: https://api.keeperhub.com/v1 (configurable).
Include retry logic (3 retries with exponential backoff).
Add request logging for the KEEPERHUB_FEEDBACK.md file.

If KeeperHub API docs aren't available, design a clean interface
and mark the actual HTTP calls with TODO comments + mock responses.

Dependencies: none (uses fetch)
```

---

### M-14: KeeperHub Settlement Integration

**Files:** `packages/integrations/keeperhub/src/settlement.ts`

**Description:** Routes pay-with-any-token settlements through KeeperHub for guaranteed execution. Combines Uniswap swap with KeeperHub's tx guarantee.

**Coding Agent Prompt:**
```
Create a KeeperHub settlement module for the AgentNet project.

File: packages/integrations/keeperhub/src/settlement.ts

This combines KeeperHub's guaranteed execution with Uniswap's
pay-with-any-token to ensure every agent payment lands on-chain.

Class KeeperHubSettlement:
  constructor(keeperHubTx: KeeperHubTx, payWithAnyToken: PayWithAnyToken)

  Methods:
  - settlePayment(params: {
      challenge: PaymentChallenge;
      payerToken: string;
      payerWallet: WalletClient;
    }): Promise<{
      receipt: PaymentReceipt;
      keeperHubId: string;
      guaranteed: boolean;
    }>
    — Executes the pay-with-any-token flow
    — Routes the final transfer through KeeperHub for guaranteed settlement
    — Returns both the PaymentReceipt and KeeperHub tracking ID

  - settleReputationUpdate(params: {
      contractAddress: string;
      agentAddress: string;
      accuracy: number;
      timeliness: number;
      uptime: number;
    }): Promise<{
      txHash: string;
      keeperHubId: string;
    }>
    — Encodes a ReputationOracle.updateScore() call
    — Submits via KeeperHub for guaranteed inclusion
    — This is how every reputation write hits the chain

  - getSettlementHistory(agentAddress: string): Promise<Array<{
      type: "payment" | "reputation";
      txHash: string;
      keeperHubId: string;
      timestamp: number;
      status: string;
    }>>

Import KeeperHubTx from ./tx-submitter.
Import PayWithAnyToken, PaymentChallenge from @agentnet/integrations-uniswap.
Import PaymentReceipt from @agentnet/types.

Dependencies: KeeperHubTx (M-13), PayWithAnyToken (M-12)
```

---

## 10. Layer 6 — Worker Agents

### M-15: Pool Indexer Worker

**Files:** `packages/agents/worker/src/tasks/pool-indexer.ts`

**Description:** Worker that indexes recent swap events from a Uniswap pool. Ground truth is actual chain data — the Reputation Agent can verify accuracy by comparing against the real events.

**Coding Agent Prompt:**
```
Create a Pool Indexer task module for AgentNet Worker agents.

File: packages/agents/worker/src/tasks/pool-indexer.ts

This Worker task indexes recent swap events from a Uniswap pool
and returns a structured summary. The Reputation Agent verifies
accuracy by comparing against actual on-chain data.

Interface PoolIndexerParams {
  poolAddress: string;       // Uniswap pool contract address
  blockRange: number;        // how many recent blocks to index
  chain?: string;            // default: "0g-testnet"
}

Interface PoolIndexerResult {
  poolAddress: string;
  token0: { address: string; symbol: string; };
  token1: { address: string; symbol: string; };
  swapCount: number;
  swaps: Array<{
    txHash: string;
    sender: string;
    amountIn: string;
    amountOut: string;
    timestamp: number;
    blockNumber: number;
  }>;
  totalVolume: { token0: string; token1: string; };
  indexedAt: number;
  blockRange: { from: number; to: number; };
}

Class PoolIndexerTask:
  constructor(storageClient: ZGStorage, computeClient: ZGCompute)

  execute(params: PoolIndexerParams): Promise<TaskResult>
    1. Use viem to fetch Swap events from the pool contract
       in the given block range
    2. Parse and structure the events into PoolIndexerResult
    3. Store the result in 0G Storage (namespace: "pool-index")
    4. Generate a WorkProof (hash of the result)
    5. Return a TaskResult with the data + proof

  validate(result: PoolIndexerResult, groundTruth: PoolIndexerResult): number
    — Compare two results, return accuracy score 0-10000
    — Check: swap count match, tx hashes match, amounts match

Import TaskResult, WorkProof from @agentnet/types.
Import ZGStorage from @agentnet/integrations-0g.

Dependencies: viem (for reading contract events)
```

---

### M-16: Wallet Summarizer Worker

**Files:** `packages/agents/worker/src/tasks/wallet-summarizer.ts`

**Description:** Worker that produces a 1-paragraph summary of a wallet's recent activity using 0G Compute for LLM inference.

**Coding Agent Prompt:**
```
Create a Wallet Summarizer task module for AgentNet Worker agents.

File: packages/agents/worker/src/tasks/wallet-summarizer.ts

This Worker reads a wallet's recent transaction history and produces
a natural-language summary using 0G Compute for LLM inference.

Interface WalletSummarizerParams {
  walletAddress: string;
  blockRange?: number;       // default: 1000 blocks
  maxTransactions?: number;  // default: 50
}

Interface WalletSummarizerResult {
  walletAddress: string;
  summary: string;           // 1-paragraph natural language summary
  stats: {
    totalTransactions: number;
    uniqueTokensInteracted: number;
    totalValueTransferred: string;
    mostActiveProtocol: string;
    timeRange: { from: number; to: number };
  };
  summarizedAt: number;
}

Class WalletSummarizerTask:
  constructor(storageClient: ZGStorage, computeClient: ZGCompute)

  execute(params: WalletSummarizerParams): Promise<TaskResult>
    1. Use viem to fetch recent transactions for the wallet
    2. Categorize transactions (swaps, transfers, contract calls)
    3. Send categorized data to 0G Compute with a prompt like:
       "Summarize this wallet's activity in one paragraph..."
    4. Store result in 0G Storage (namespace: "wallet-summaries")
    5. Generate WorkProof and return TaskResult

Dependencies: viem, ZGStorage (M-08), ZGCompute (M-09)
```

---

### M-17: Token Fact-Checker Worker

**Files:** `packages/agents/worker/src/tasks/token-fact-checker.ts`

**Description:** Worker that analyzes a token contract to determine if it's legitimate, a honeypot, or a rug pull. Uses 0G Compute for analysis.

**Coding Agent Prompt:**
```
Create a Token Fact-Checker task module for AgentNet Worker agents.

File: packages/agents/worker/src/tasks/token-fact-checker.ts

This Worker analyzes a token contract to determine if it's safe.
It checks contract code patterns, liquidity, holder distribution,
and uses 0G Compute for LLM-based analysis.

Interface TokenFactCheckerParams {
  tokenAddress: string;
  chain?: string;
}

Interface TokenFactCheckerResult {
  tokenAddress: string;
  verdict: "legit" | "honeypot" | "rug" | "suspicious" | "unknown";
  confidence: number;        // 0-100
  reasoning: string;
  checks: {
    hasVerifiedSource: boolean;
    hasMintFunction: boolean;
    hasBlacklist: boolean;
    hasPausable: boolean;
    liquidityLocked: boolean;
    topHolderConcentration: number;  // percentage held by top 10
    contractAge: number;             // days
  };
  analyzedAt: number;
}

Class TokenFactCheckerTask:
  constructor(storageClient: ZGStorage, computeClient: ZGCompute)

  execute(params: TokenFactCheckerParams): Promise<TaskResult>
    1. Fetch contract bytecode and (if verified) source using viem
    2. Check for known dangerous patterns (mint, blacklist, pause)
    3. Fetch holder distribution (top holders %)
    4. Check liquidity status
    5. Send analysis to 0G Compute for LLM verdict
    6. Store in 0G Storage (namespace: "token-checks")
    7. Return TaskResult with WorkProof

Dependencies: viem, ZGStorage (M-08), ZGCompute (M-09)
```

---

### M-18 (shared numbering — Worker Agent Shell)

**Files:** `packages/agents/worker/src/worker-agent.ts`

**Description:** The Worker Agent class that extends AgentBase, registers with the WorkerRegistry contract, listens for task requests, dispatches to the correct task module, and handles the payment flow.

**Coding Agent Prompt:**
```
Create the main Worker Agent class for the AgentNet project.

File: packages/agents/worker/src/worker-agent.ts

This extends AgentBase and orchestrates the full Worker lifecycle:
registration, task listening, execution, payment, and proof publishing.

Class WorkerAgent extends AgentBase:
  constructor(config: AgentConfig & {
    capabilities: TaskType[];
    feePerTask: bigint;
    preferredToken: string;
  })

  Properties:
  - tasks: Map<TaskType, PoolIndexerTask | WalletSummarizerTask | TokenFactCheckerTask>
  - capabilities: TaskType[]
  - feePerTask: bigint
  - preferredToken: string

  start():
    1. Register with WorkerRegistry contract on-chain
    2. Store agent profile in 0G Storage
    3. Subscribe to message bus for task-request messages
    4. Set status to "idle"
    5. Start heartbeat loop (every 30s, broadcast heartbeat message)

  stop():
    1. Deactivate in WorkerRegistry
    2. Unsubscribe from message bus
    3. Set status to "offline"

  handleMessage(message: AgentMessage):
    - If task-request:
      1. Validate request (check capability, fee)
      2. Create PaymentChallenge (x402)
      3. Send challenge back to requester
      4. Wait for payment confirmation
      5. Execute task via the appropriate task module
      6. Publish WorkProof to 0G DA
      7. Send task-result message back to requester

  Private methods:
  - registerOnChain(): Promise<string> — call WorkerRegistry.register()
  - executeTask(request: TaskRequest): Promise<TaskResult>
  - publishProof(result: TaskResult): Promise<void>

Import from: @agentnet/core (AgentBase, messageBus)
Import from: @agentnet/integrations-0g (ZGStorage, ZGCompute, ZGDA)
Import from: @agentnet/integrations-uniswap (PayWithAnyToken)
Import task modules from ./tasks/*

Dependencies: All Layer 3-5 modules
```

---

## 11. Layer 7 — Reputation Agent

### M-19: Reputation Indexer Module

**Files:** `packages/agents/reputation/src/modules/indexer.ts`

**Description:** Subscribes to 0G DA for work-proof events and indexes them for the scorer.

**Coding Agent Prompt:**
```
Create the Reputation Indexer module for the AgentNet Reputation Agent.

File: packages/agents/reputation/src/modules/indexer.ts

This module subscribes to 0G DA events and maintains an index of
all worker output that needs to be scored.

Class ReputationIndexer:
  constructor(daClient: ZGDA, storageClient: ZGStorage)

  Properties:
  - pendingScores: Map<string, { proof: WorkProof; receivedAt: number }>
  - processedCount: number

  Methods:
  - start(): void
    — subscribes to DA events via daClient.subscribe()
    — on each WorkProof event, adds to pendingScores map
    — logs new proofs received

  - stop(): void — unsubscribes

  - getPendingProofs(): WorkProof[]
    — returns all unscored work proofs, oldest first

  - markProcessed(taskId: string): void
    — removes from pendingScores, increments processedCount

  - getStats(): { pending: number; processed: number; }

Import ZGDA, WorkProof, DAEvent from appropriate packages.
```

---

### M-20: Reputation Scorer Module

**Files:** `packages/agents/reputation/src/modules/scorer.ts`

**Description:** Takes work proofs, fetches ground truth, scores accuracy/timeliness using 0G Compute, and outputs ScoreUpdates.

**Coding Agent Prompt:**
```
Create the Reputation Scorer module for the AgentNet Reputation Agent.

File: packages/agents/reputation/src/modules/scorer.ts

This module scores worker output against ground truth data.

Class ReputationScorer:
  constructor(computeClient: ZGCompute, storageClient: ZGStorage)

  Methods:
  - scoreWorkProof(proof: WorkProof): Promise<ScoreUpdate>
    1. Fetch the worker's actual result from 0G Storage using proof.taskId
    2. Fetch/generate ground truth for the same task:
       - Pool Indexer: re-index the same pool and compare
       - Wallet Summarizer: use 0G Compute to cross-check
       - Token Fact-Checker: compare against labeled dataset
    3. Calculate accuracy (0-10000) by comparing result vs ground truth
    4. Calculate timeliness: (maxExpectedTime - actualTime) / maxExpectedTime * 10000
       — capped at 0 if overtime
    5. Fetch uptime from storage (heartbeats received / expected)
    6. Return ScoreUpdate with all three dimensions

  - getGroundTruth(taskType: TaskType, params: Record<string, unknown>): Promise<unknown>
    — dispatches to the appropriate ground-truth fetcher
    — For pool-indexer: directly query chain for real swap events
    — For wallet-summarizer: generate reference summary via 0G Compute
    — For token-fact-checker: look up from labeled dataset in storage

  - calculateAccuracy(result: unknown, groundTruth: unknown, taskType: TaskType): number
    — type-specific comparison logic, returns 0-10000

Import ScoreUpdate from @agentnet/types.
Dependencies: ZGCompute (M-09), ZGStorage (M-08)
```

---

### M-21: Reputation Watchdog Module

**Files:** `packages/agents/reputation/src/modules/watchdog.ts`

**Description:** Anomaly detection — catches workers that game the system (e.g., sudden quality drops, collusion patterns, Sybil behavior).

**Coding Agent Prompt:**
```
Create the Reputation Watchdog module for the AgentNet Reputation Agent.

File: packages/agents/reputation/src/modules/watchdog.ts

This module detects anomalous worker behavior and flags it.

Class ReputationWatchdog:
  constructor(storageClient: ZGStorage)

  Properties:
  - alerts: Array<WatchdogAlert>

  Methods:
  - analyze(agentAddress: string, recentScores: ScoreUpdate[]): WatchdogAlert | null
    Checks for:
    1. Sudden quality drop: if latest score is >30% below rolling average
    2. Suspiciously perfect scores: if last 10 scores are all >9900
    3. Copy-cat detection: if result hashes match another worker's
    4. Uptime anomaly: if heartbeats suddenly stop then resume

  - getAlerts(agentAddress?: string): WatchdogAlert[]
    — returns all alerts, optionally filtered by agent

  - clearAlert(alertId: string): void

Interface WatchdogAlert {
  id: string;
  agentAddress: string;
  type: "quality-drop" | "suspicious-perfection" | "copy-cat" | "uptime-anomaly";
  severity: "low" | "medium" | "high";
  description: string;
  evidence: Record<string, unknown>;
  timestamp: number;
}

Export WatchdogAlert type.
```

---

### M-22: Reputation Agent Shell

**Files:** `packages/agents/reputation/src/reputation-agent.ts`

**Description:** The Reputation Agent class that extends AgentBase and orchestrates the indexer, scorer, and watchdog modules.

**Coding Agent Prompt:**
```
Create the main Reputation Agent class for the AgentNet project.

File: packages/agents/reputation/src/reputation-agent.ts

This extends AgentBase and runs the three reputation modules in
a continuous loop.

Class ReputationAgent extends AgentBase:
  constructor(config: AgentConfig)

  Properties:
  - indexer: ReputationIndexer
  - scorer: ReputationScorer
  - watchdog: ReputationWatchdog
  - settlement: KeeperHubSettlement
  - scoringInterval: NodeJS.Timeout

  start():
    1. Initialize all three modules with 0G clients
    2. Start the indexer (subscribes to DA)
    3. Start a scoring loop (every 10 seconds):
       a. Get pending proofs from indexer
       b. Score each proof via scorer
       c. Run watchdog analysis on each scored agent
       d. Submit score updates on-chain via KeeperHubSettlement.settleReputationUpdate()
       e. Mark proofs as processed
       f. Broadcast score-update messages on the message bus
    4. Set status to "idle" between loops, "working" during scoring

  stop():
    1. Clear scoring interval
    2. Stop indexer
    3. Set status to "offline"

  handleMessage(message: AgentMessage):
    — Listen for manual score requests or admin commands

  getAgentScores(): Map<string, ReputationScore>
    — Returns current scores for all known workers

Import all modules from ./modules/*
Import KeeperHubSettlement from @agentnet/integrations-keeperhub
```

---

## 12. Layer 8 — Client Agents

### M-23: Client Agent

**Files:** `packages/agents/client/src/client-agent.ts`

**Description:** Simulated end-user that discovers Workers, issues task requests, pays in random tokens, and evaluates results.

**Coding Agent Prompt:**
```
Create the Client Agent for the AgentNet project.

File: packages/agents/client/src/client-agent.ts

This extends AgentBase and simulates an end-user that buys Worker
services. In the demo, these are scripted; in production they'd
be real users.

Class ClientAgent extends AgentBase:
  constructor(config: AgentConfig & {
    paymentTokens: string[];   // tokens this client holds
    taskPreferences: TaskType[];
    budget: bigint;
  })

  Properties:
  - paymentTokens: string[] — random selection of [USDC, WETH, USDT]
  - settlement: KeeperHubSettlement
  - completedTasks: TaskResult[]
  - spent: bigint

  start():
    1. Subscribe to message bus
    2. Start a task-request loop (configurable interval, default 30s):
       a. Pick a random task type from preferences
       b. Query WorkerRegistry for active workers with that capability
       c. Optionally filter by reputation (query ReputationOracle)
       d. Pick the best worker (highest composite score within budget)
       e. Send a task-request message
       f. Wait for x402 challenge response
       g. Pay via KeeperHubSettlement with a random payment token
       h. Wait for task-result message
       i. Log the result

  stop():
    1. Unsubscribe from message bus
    2. Log summary (tasks completed, amount spent)

  handleMessage(message: AgentMessage):
    - "task-result": store result, log completion
    - "payment-challenge": fulfill via pay-with-any-token

  getActivity(): Array<{ taskId, workerAddress, paid, token, result }>

Dependencies: KeeperHubSettlement (M-14), message bus, viem
```

---

## 13. Layer 9 — MCP Server

### M-24: MCP Server

**Files:** `packages/mcp-server/src/index.ts`, `packages/mcp-server/src/tools.ts`

**Description:** Exposes Worker agents as MCP-callable tools, fulfilling the KeeperHub submission requirement.

**Coding Agent Prompt:**
```
Create an MCP (Model Context Protocol) server for the AgentNet project.

File 1: packages/mcp-server/src/tools.ts
Define MCP tool schemas for each worker capability:
- index_uniswap_pool: { poolAddress: string, blockRange?: number }
- summarize_wallet: { walletAddress: string, blockRange?: number }
- check_token: { tokenAddress: string }
- get_worker_reputation: { workerAddress: string }
- list_active_workers: { capability?: string }

Each tool should:
1. Find the best available Worker for the task (by reputation)
2. Send a task request via the message bus
3. Handle payment automatically
4. Return the task result

File 2: packages/mcp-server/src/index.ts
- Create an MCP server using the @modelcontextprotocol/sdk
- Register all tools from tools.ts
- Add resource endpoints:
  - agentnet://workers — list all workers
  - agentnet://scores — current reputation scores
  - agentnet://activity — recent activity feed
- Start the server on stdio transport (for Claude integration)

Dependencies: @modelcontextprotocol/sdk
```

---

## 14. Layer 10 — Frontend Explorer

### M-25: API Server

**Files:** `packages/frontend/src/app/api/workers/route.ts`, `packages/frontend/src/app/api/activity/route.ts`, `packages/frontend/src/app/api/scores/route.ts`

**Description:** Next.js API routes that serve data from the agent system to the frontend.

**Coding Agent Prompt:**
```
Create Next.js API routes for the AgentNet Explorer frontend.

All files are in packages/frontend/src/app/api/

Route 1: workers/route.ts
  GET /api/workers — returns WorkerListItem[] (all active workers
  with their current scores, capabilities, and fees)
  Query params: ?capability=pool-indexer&sortBy=score

Route 2: scores/route.ts
  GET /api/scores — returns all agent scores from ReputationOracle
  GET /api/scores/[address] — returns score history for one agent
  Response includes score timeline data for charting

Route 3: activity/route.ts
  GET /api/activity — returns ActivityEvent[] (recent task completions,
  payments, score updates)
  Query params: ?limit=50&type=payment&agent=0x...
  Uses 0G DA events as the data source

Route 4: stats/route.ts
  GET /api/stats — returns aggregate stats:
  { totalWorkers, totalTasks, totalPayments, avgReputation }

Use viem to read from contracts (ReputationOracle, WorkerRegistry).
Connect to the running agent system for live data.
Import types from @agentnet/types.

Each route should handle errors gracefully and return proper
HTTP status codes.
```

---

### M-26: Worker List & Detail Pages

**Files:** `packages/frontend/src/app/page.tsx`, `packages/frontend/src/app/workers/[address]/page.tsx`, `packages/frontend/src/components/WorkerCard.tsx`

**Description:** Main explorer page showing all registered Workers with their scores, capabilities, and status.

**Coding Agent Prompt:**
```
Create the Worker List page for the AgentNet Explorer.

File 1: packages/frontend/src/components/WorkerCard.tsx
A card component showing a single Worker:
- Truncated address (0x1234...5678) with copy button
- Composite reputation score (large number + color: green >7500, yellow >5000, red below)
- Capabilities as small tags/badges
- Fee per task
- Status indicator (green dot = active, gray = offline)
- Click to navigate to detail page

File 2: packages/frontend/src/app/page.tsx
The main explorer page:
- Header: "AgentNet Explorer" with live stats bar
  (total workers, total tasks completed, total payments)
- Filter bar: filter by capability, sort by score/fee/recent
- Grid of WorkerCards (fetched from /api/workers)
- Auto-refresh every 10 seconds

File 3: packages/frontend/src/app/workers/[address]/page.tsx
Worker detail page:
- Full address, registration date
- Current scores (accuracy, timeliness, uptime, composite) as gauges
- Task history table (recent tasks with results)
- Payment history
- Score timeline chart placeholder (M-27 builds the chart)

Use Next.js 14 App Router, TailwindCSS for styling.
Fetch data with React hooks (useSWR or useEffect + fetch).
Import types from @agentnet/types.
```

---

### M-27: Score Timeline Chart

**Files:** `packages/frontend/src/components/ScoreTimeline.tsx`

**Description:** Recharts-based line chart showing an agent's reputation score over time.

**Coding Agent Prompt:**
```
Create a Score Timeline chart component for the AgentNet Explorer.

File: packages/frontend/src/components/ScoreTimeline.tsx

A Recharts LineChart that shows an agent's reputation scores over time.

Props:
  address: string — the agent's address
  timeRange?: "1h" | "24h" | "7d" | "all" — default "24h"

Behavior:
- Fetch score history from /api/scores/[address]
- Display 4 lines: accuracy, timeliness, uptime, composite
- Each line is a different color with a legend
- X-axis: time (formatted based on timeRange)
- Y-axis: score 0-10000 (display as 0-100%)
- Tooltip on hover showing exact values
- Time range selector buttons at top-right

- Use Recharts (LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer)
- Use TailwindCSS for the container and controls
- Handle loading and empty states gracefully
```

---

### M-28: Live Activity Feed

**Files:** `packages/frontend/src/components/ActivityFeed.tsx`

**Description:** Real-time feed showing task completions, payments, and score updates.

**Coding Agent Prompt:**
```
Create a Live Activity Feed component for the AgentNet Explorer.

File: packages/frontend/src/components/ActivityFeed.tsx

A real-time scrolling feed of system events.

Props:
  filter?: "all" | "task" | "payment" | "score"
  maxItems?: number — default 50

Behavior:
- Fetch events from /api/activity, poll every 5 seconds
- New events animate in from the top
- Each event shows:
  - Icon based on type (task=gear, payment=dollar, score=star)
  - Summary text (e.g., "Worker 0x12...34 completed pool-indexer task")
  - Time ago (e.g., "2s ago", "5m ago")
  - TX hash link (if available) to block explorer
  - Involved agents (clickable links to their detail pages)
- Filter tabs at top: All | Tasks | Payments | Scores
- Fade out old events at the bottom

Use TailwindCSS. Handle empty state ("No activity yet").
Import ActivityEvent from @agentnet/types.
```

---

### M-29: Reputation-Aware Worker Selector

**Files:** `packages/frontend/src/components/WorkerSelector.tsx`

**Description:** UI component where users pick the best Worker for a task, with reputation-based recommendations. This is the "demo climax" component.

**Coding Agent Prompt:**
```
Create a Worker Selector component for the AgentNet Explorer.
This is the "demo climax" — it visually shows reputation filtering.

File: packages/frontend/src/components/WorkerSelector.tsx

Props:
  taskType: TaskType
  onSelect: (workerAddress: string) => void

Behavior:
- Fetch workers with the given capability from /api/workers
- Display them in a ranked list, sorted by composite score
- Each row shows:
  - Rank number
  - Worker address
  - Composite score as a colored bar (green/yellow/red)
  - Fee
  - "Select" button

- Workers with score <3000 get a red warning badge: "Low Reputation"
- Workers with score <1000 get crossed out with "Filtered — Unreliable"
- Top worker gets a gold highlight: "Recommended"

- Animated entrance: workers slide in one by one from top to bottom
- When a low-rep worker is filtered, show a brief animation/strikethrough

- Bottom section: "Why reputation matters" — brief explainer text

- Include a "Demo Mode" toggle that:
  - When ON: auto-selects the top worker after 3 seconds
  - Shows the filtering animation automatically

Use TailwindCSS + framer-motion for animations.
Import types from @agentnet/types.
```

---

## 15. Layer 11 — Orchestration & Demo

### M-30: Cold-Start Seed Script

**Files:** `scripts/seed.ts`

**Description:** Seeds the system with 20–30 Workers with varied performance profiles for the demo.

**Coding Agent Prompt:**
```
Create a cold-start seed script for the AgentNet project.

File: scripts/seed.ts

This script bootstraps the demo by creating 20-30 Worker agents
with varied performance profiles and pre-seeding reputation data.

Worker Profiles (create programmatically):
- 3 "broken" workers: always return incorrect data (accuracy <1000)
- 5 "elite" workers: fast, accurate (accuracy >9000, timeliness >9000)
- 7 "good" workers: reliable but not perfect (accuracy 7000-8500)
- 5 "mediocre" workers: inconsistent (accuracy 4000-6000)
- 5 "new" workers: few jobs, no established reputation yet

For each worker:
1. Generate a wallet (deterministic from seed phrase + index)
2. Create a WorkerAgent instance with random capabilities
   (1-3 of: pool-indexer, wallet-summarizer, token-fact-checker)
3. Register on-chain via WorkerRegistry
4. Pre-seed some task history:
   - Execute 5-20 tasks per worker (proportional to profile)
   - Store results in 0G Storage
   - Publish work proofs to 0G DA
5. Run the Reputation Agent to score all pre-seeded work
6. Log a summary table of all workers with their scores

Configuration:
- SEED_COUNT=25 (env var override)
- SEED_PHRASE for deterministic wallets
- Run in "fast mode" (skip actual inference, use canned results)

Output: console table + JSON file with all worker addresses and profiles.

Dependencies: All agent packages, viem (for wallet generation)
```

---

### M-31: Orchestrator

**Files:** `scripts/orchestrator.ts`

**Description:** Starts all agents, connects them, and runs the live demo loop.

**Coding Agent Prompt:**
```
Create an orchestrator script for the AgentNet project.

File: scripts/orchestrator.ts

This starts the entire AgentNet system: all agents, the MCP server,
and the frontend, connected via the message bus.

Steps:
1. Load config from .env
2. Initialize shared services:
   - ZGStorage, ZGCompute, ZGDA clients
   - UniswapSwapClient, PayWithAnyToken
   - KeeperHubTx, KeeperHubSettlement
   - MessageBus (singleton)

3. Start agents:
   - Load seeded workers from seed output (or run seed if needed)
   - Start all WorkerAgents (register + subscribe to bus)
   - Start the ReputationAgent (subscribe to DA)
   - Start 3-5 ClientAgents with different token portfolios:
     - Client A: holds only USDC
     - Client B: holds only WETH
     - Client C: holds USDT + random tokens

4. Start auxiliary services:
   - MCP server (stdio)
   - API server (for frontend)

5. Run the demo loop:
   - Clients issue tasks every 15-30 seconds (randomized)
   - Log all activity to console with clear formatting
   - Track aggregate stats

6. Handle graceful shutdown on SIGINT:
   - Stop all agents
   - Print final stats summary

Export a main() function and call it if run directly.

Dependencies: All agent + integration packages
```

---

### M-32: Demo Script

**Files:** `scripts/demo.ts`

**Description:** Scripted demo sequence matching the 3-minute demo video plan.

**Coding Agent Prompt:**
```
Create a scripted demo sequence for the AgentNet project.

File: scripts/demo.ts

This runs a carefully timed demo matching the 3-minute video script.
Each "beat" is a function that executes and waits for completion.

Demo Beats:
1. [0:00-0:25] Setup — show the swarm is running (log worker count, avg score)
2. [0:25-0:55] Discovery — list all workers with scores, highlight variation
3. [0:55-1:30] Task Flow:
   a. Client C issues a pool-indexer request
   b. Show x402 challenge being sent
   c. Worker accepts, executes on 0G Compute
   d. Worker delivers result + invoice
4. [1:30-2:05] Payment Flow:
   a. Client C pays in USDC
   b. Worker wants ETH
   c. Show Uniswap swap happening (log quote, execution)
   d. Show KeeperHub guaranteeing settlement (log keeper ID)
5. [2:05-2:30] Reputation Update:
   a. Reputation Agent picks up work proof from DA
   b. Scores accuracy vs ground truth
   c. Publishes score on-chain via KeeperHub
   d. Score reflected in explorer
6. [2:30-2:50] Climax:
   a. Client issues high-value task
   b. Show bad worker being filtered by reputation
   c. Best worker auto-selected
7. [2:50-3:00] Summary stats

Each beat:
- Logs a clear header ("=== BEAT 3: TASK FLOW ===")
- Executes the actual agent calls (not mocked)
- Waits for completion before moving to next beat
- Includes configurable delays for video pacing

Dependencies: orchestrator setup functions
```

---

## 16. Layer 12 — Submission Deliverables

### M-33: README & Architecture Diagram

**Files:** `README.md`

**Coding Agent Prompt:**
```
Create the README.md for the AgentNet project submission.

Sections:
1. Project name + one-liner pitch
2. Architecture diagram (ASCII art, same as in the plan)
3. What it does — 3 paragraphs explaining the agent swarm
4. How it's built:
   - 0G: Storage for agent memory, Compute for inference, DA for work proofs
   - Uniswap: pay-with-any-token via Trading API + x402/MPP
   - KeeperHub: guaranteed execution for reputation writes + settlements
5. Getting Started:
   - Prerequisites (Node.js 20+, pnpm)
   - Clone, install, configure .env
   - Run seed script
   - Start the system
   - Open explorer
6. Contract Addresses (0G Chain Testnet):
   - ReputationOracle: [address]
   - WorkerRegistry: [address]
7. Demo video link
8. Team + contact info
9. License: MIT
```

---

### M-34: FEEDBACK.md (Uniswap)

**Files:** `FEEDBACK.md`

**Coding Agent Prompt:**
```
Create FEEDBACK.md for the Uniswap submission (required for prize eligibility).

Structure:
1. Which uniswap-ai plugins used: uniswap-trading, uniswap-viem
2. What worked well
3. What was confusing or hard
4. Feature requests / suggestions
5. Documentation feedback
6. Integration experience rating (1-5)

Write it as a genuine developer feedback document — not marketing.
Include specific code examples of what was easy/hard.
Mention the pay-with-any-token skill and x402 integration specifically.
```

---

### M-35: KEEPERHUB_FEEDBACK.md

**Files:** `KEEPERHUB_FEEDBACK.md`

**Coding Agent Prompt:**
```
Create KEEPERHUB_FEEDBACK.md for the KeeperHub submission (separate $500 bounty).

Structure:
1. How KeeperHub is used in AgentNet:
   - Every reputation score write goes through KeeperHub
   - Payment settlement guaranteed by KeeperHub
2. Integration experience
3. API feedback (what worked, what could be better)
4. MCP server integration notes
5. Feature requests
6. Documentation quality feedback

Be specific and constructive. Include code snippets showing
the integration points.
```

---

## 17. Build Order & Parallelism Map

This shows which modules can be built simultaneously by independent coding agents.

```
PHASE 1 (Day 1-2): Foundation — all parallel
├── Agent A: M-01 (Monorepo Scaffold)
├── Agent B: M-04 (Shared Types)
├── Agent C: M-02 (Reputation Oracle Contract)
└── Agent D: M-03 (Worker Registry Contract)

PHASE 2 (Day 2-3): Core SDK — parallel after M-01 + M-04
├── Agent A: M-05 (Config Manager)
├── Agent B: M-06 (Agent Base Class)
└── Agent C: M-07 (Messaging Protocol)

PHASE 3 (Day 3-4): Integrations — all parallel after Phase 2
├── Agent A: M-08 (0G Storage)
├── Agent B: M-09 (0G Compute)
├── Agent C: M-10 (0G DA)
├── Agent D: M-11 (Uniswap Swap)
└── Agent E: M-13 (KeeperHub TX)

PHASE 4 (Day 4-5): Integration Combos — after Phase 3
├── Agent A: M-12 (Pay-With-Any-Token) — needs M-11
└── Agent B: M-14 (KeeperHub Settlement) — needs M-12 + M-13

PHASE 5 (Day 5-6): Worker Tasks — all parallel after Phase 3
├── Agent A: M-15 (Pool Indexer)
├── Agent B: M-16 (Wallet Summarizer)
└── Agent C: M-17 (Token Fact-Checker)

PHASE 6 (Day 6-7): Agent Shells — after Phases 4+5
├── Agent A: M-18 (Worker Agent Shell)
├── Agent B: M-19 + M-20 + M-21 (Reputation Modules)
└── Agent C: M-22 (Reputation Agent Shell)

PHASE 7 (Day 7-8): Clients + Server — after Phase 6
├── Agent A: M-23 (Client Agent)
└── Agent B: M-24 (MCP Server)

PHASE 8 (Day 8-9): Frontend — parallel after Phase 6
├── Agent A: M-25 (API Server)
├── Agent B: M-26 (Worker List UI)
├── Agent C: M-27 (Score Timeline)
├── Agent D: M-28 (Activity Feed)
└── Agent E: M-29 (Worker Selector)

PHASE 9 (Day 9-10): Orchestration — after Phase 7
├── Agent A: M-30 (Cold-Start Seed)
├── Agent B: M-31 (Orchestrator)
└── Agent C: M-32 (Demo Script)

PHASE 10 (Day 10-11): Deliverables — after Phase 9
├── Agent A: M-33 (README)
├── Agent B: M-34 (FEEDBACK.md)
└── Agent C: M-35 (KEEPERHUB_FEEDBACK.md)
```

### Maximum Parallelism: 5 agents at once (Phases 3, 8)
### Total Modules: 35
### Critical Path: M-01 → M-04 → M-06 → M-08/09 → M-15 → M-18 → M-22 → M-31 → M-32

---

## 18. Coding Agent Prompt Templates

Each prompt above is ready to copy-paste to a coding agent. When using them:

1. **Prefix** each prompt with the project context:
   ```
   You are building a module for AgentNet, a decentralized AI agent
   swarm on 0G Chain. The project is a TypeScript monorepo using pnpm
   and Turborepo. Your module will be integrated with others — follow
   the interfaces exactly as specified.
   ```

2. **Suffix** each prompt with quality requirements:
   ```
   Requirements:
   - Use TypeScript strict mode
   - Add JSDoc comments on all public methods
   - Export all public types and classes
   - Handle errors with descriptive messages (no silent failures)
   - Add a barrel export in src/index.ts
   - Write at least 3 unit tests using Vitest
   - Use named exports (no default exports except React components)
   ```

3. **For integration modules** (Layers 3-5), add:
   ```
   If the external SDK is not available or the API shape is unknown,
   implement a clean interface with TODO markers at the actual API
   call sites, and provide a mock in-memory implementation that the
   rest of the system can use during development.
   ```

---

## Quick Reference: Module Index

| ID | Module | Layer | Package | Key Dependencies |
|----|--------|-------|---------|-----------------|
| M-01 | Monorepo Scaffold | 0 | root | — |
| M-02 | Reputation Oracle | 1 | contracts | Solidity, Hardhat |
| M-03 | Worker Registry | 1 | contracts | Solidity, Hardhat |
| M-04 | Shared Types | 2 | types | — |
| M-05 | Config Manager | 2 | config | M-04 |
| M-06 | Agent Base Class | 2 | core | M-04, M-05, viem |
| M-07 | Messaging Protocol | 2 | core | M-04, viem |
| M-08 | 0G Storage | 3 | integrations/0g | M-06, 0G SDK |
| M-09 | 0G Compute | 3 | integrations/0g | M-06, 0G SDK |
| M-10 | 0G DA | 3 | integrations/0g | M-06, 0G SDK |
| M-11 | Uniswap Swap | 4 | integrations/uniswap | M-06, viem |
| M-12 | Pay-With-Any-Token | 4 | integrations/uniswap | M-11 |
| M-13 | KeeperHub TX | 5 | integrations/keeperhub | M-06 |
| M-14 | KeeperHub Settlement | 5 | integrations/keeperhub | M-12, M-13 |
| M-15 | Pool Indexer | 6 | agents/worker | M-08, M-09 |
| M-16 | Wallet Summarizer | 6 | agents/worker | M-08, M-09 |
| M-17 | Token Fact-Checker | 6 | agents/worker | M-08, M-09 |
| M-18 | Worker Agent Shell | 6 | agents/worker | M-15-17, M-12, M-10 |
| M-19 | Rep Indexer | 7 | agents/reputation | M-10, M-08 |
| M-20 | Rep Scorer | 7 | agents/reputation | M-09, M-08 |
| M-21 | Rep Watchdog | 7 | agents/reputation | M-08 |
| M-22 | Rep Agent Shell | 7 | agents/reputation | M-19-21, M-14 |
| M-23 | Client Agent | 8 | agents/client | M-14, M-07 |
| M-24 | MCP Server | 9 | mcp-server | M-18, M-07 |
| M-25 | API Server | 10 | frontend | M-04, viem |
| M-26 | Worker List UI | 10 | frontend | M-25 |
| M-27 | Score Timeline | 10 | frontend | M-25 |
| M-28 | Activity Feed | 10 | frontend | M-25 |
| M-29 | Worker Selector | 10 | frontend | M-25 |
| M-30 | Cold-Start Seed | 11 | scripts | M-18, M-22 |
| M-31 | Orchestrator | 11 | scripts | All agents |
| M-32 | Demo Script | 11 | scripts | M-31 |
| M-33 | README | 12 | root | — |
| M-34 | FEEDBACK.md | 12 | root | — |
| M-35 | KEEPERHUB_FEEDBACK.md | 12 | root | — |
