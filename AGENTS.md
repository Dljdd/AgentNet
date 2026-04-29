# AGENTS.md — Instructions for Coding Agents

> This file is the single source of truth for any AI coding agent (Claude Code, Cursor, Copilot, etc.) working on this repository. Read this FIRST before writing any code.

---

## Project Overview

**AgentNet** is a decentralized AI agent swarm built for the ETHGlobal OpenAgents hackathon (Apr 24 – May 6, 2026). Agents do real onchain work, get paid in any token (via Uniswap), and build verifiable reputation onchain (scored by an AI Reputation Agent, published via KeeperHub).

**Repository:** pnpm monorepo with Turborepo. All packages live under `packages/`. Scripts live under `scripts/`.

**Chain:** 0G Chain Testnet (EVM-compatible).

**Language:** TypeScript everywhere (except Solidity contracts).

---

## Before You Start Any Module

1. **Read the implementation plan:** Open `IMPLEMENTATION_PLAN.md` and find your module by its ID (M-01 through M-35). Each module has a complete spec with interfaces, file paths, and a ready-to-use prompt.

2. **Check the dependency graph:** See `docs/agentnet_module_dependency_map.svg` or the ASCII graph in the implementation plan (Section 3). Do NOT start a module if its dependencies aren't merged yet. Check the layer number — lower layers must be built first.

3. **Check what exists:** Run `pnpm list -r` to see installed packages. Check if the packages you depend on have their `src/index.ts` populated (not just the empty scaffold).

4. **Use the shared types:** Import ALL types from `@agentnet/types`. Never define duplicate types locally. If you need a new type, add it to `packages/types/src/index.ts` and export it.

5. **Use the shared config:** Import `getConfig()` from `@agentnet/config` for all environment variables. Never read `process.env` directly in any package except `packages/config`.

---

## Coding Standards

### TypeScript
- **Strict mode** — `"strict": true` in all tsconfig.json files
- **ES2022 target**, `NodeNext` module resolution
- **Named exports only** — no `export default` (exception: React page components in Next.js)
- **JSDoc comments** on all public methods and interfaces
- **No `any` types** — use `unknown` + type guards if the type is truly dynamic
- **Barrel exports** — every package must have `src/index.ts` that re-exports all public APIs

### Error Handling
- **No silent failures** — every catch block must log and either re-throw or return a typed error
- **Descriptive error messages** — include the module name, function name, and relevant IDs
- Example: `throw new Error('[ZGStorage.put] Failed to store key "${key}" in namespace "${namespace}": ${error.message}')`

### Dependencies
- **viem** for all blockchain interaction (NOT ethers.js)
- **0G SDK** (`@0glabs/0g-ts-sdk`) for 0G integrations — if the SDK is unavailable or the API shape is unknown, implement a clean interface with `// TODO: Replace with actual 0G SDK call` markers and provide a mock in-memory fallback
- **Uniswap Trading API** via HTTP fetch (not the Uniswap SDK directly)
- **KeeperHub API** via HTTP fetch
- **nanoid** for generating unique IDs
- **zod** for runtime validation in config and API routes
- **vitest** for all unit tests

### File Structure Per Package
```
packages/my-package/
├── src/
│   ├── index.ts          # Barrel export — re-exports everything public
│   ├── my-class.ts       # Implementation files
│   └── my-class.test.ts  # Co-located tests (or in __tests__/)
├── package.json
└── tsconfig.json
```

---

## Module Build Instructions

### How to Build a Module

1. Find your module in `IMPLEMENTATION_PLAN.md` (search for `### M-XX`)
2. Read the full spec: description, file paths, interfaces, coding agent prompt
3. Create the files at the exact paths specified
4. Implement all interfaces exactly as specified — other modules depend on these signatures
5. Write at least 3 unit tests using Vitest
6. Add barrel exports to `src/index.ts`
7. Run `pnpm typecheck` to verify no type errors
8. Run `pnpm --filter <package-name> test` to verify tests pass
9. Commit with message: `feat(M-XX): <module name>`

### Commit Message Format
```
feat(M-XX): Short description

- What was built
- Key decisions made
- Any TODOs left
```

Examples:
```
feat(M-01): Monorepo scaffold with all workspace packages
feat(M-02): ReputationOracle contract with Hardhat tests
feat(M-08): 0G Storage wrapper with mock fallback
```

---

## Layer-by-Layer Build Order

Build bottom-up. All modules within the same layer can be built in parallel.

### Layer 0 — Foundation (build first, everything depends on this)
| Module | Package | What to Build |
|--------|---------|---------------|
| M-01 | root | Monorepo scaffold: pnpm workspaces, Turborepo, tsconfig, .env.example |

### Layer 1 — Smart Contracts (parallel, after Layer 0)
| Module | Package | What to Build |
|--------|---------|---------------|
| M-02 | contracts | `ReputationOracle.sol` — stores agent reputation scores onchain |
| M-03 | contracts | `WorkerRegistry.sol` — onchain registry for worker agents |

### Layer 2 — Core SDK (parallel, after Layer 0)
| Module | Package | What to Build |
|--------|---------|---------------|
| M-04 | types | All shared TypeScript interfaces (Agent, Task, Reputation, Payment, Message, 0G, API) |
| M-05 | config | Environment config loader + chain constants + contract addresses |
| M-06 | core | `AgentBase` abstract class — lifecycle, wallet, logging, signing |
| M-07 | core | `MessageBus` — in-process pub/sub for agent-to-agent messaging |

### Layer 3 — 0G Integrations (parallel, after Layer 2)
| Module | Package | What to Build |
|--------|---------|---------------|
| M-08 | integrations/0g | `ZGStorage` — KV store + log streams on 0G Storage |
| M-09 | integrations/0g | `ZGCompute` — LLM inference on 0G Compute Network |
| M-10 | integrations/0g | `ZGDA` — publish/subscribe work proofs on 0G DA |

### Layer 4 — Uniswap Integration (sequential: M-11 then M-12)
| Module | Package | What to Build |
|--------|---------|---------------|
| M-11 | integrations/uniswap | `UniswapSwapClient` — quote + execute swaps via Trading API |
| M-12 | integrations/uniswap | `PayWithAnyToken` — x402/MPP flow (depends on M-11) |

### Layer 5 — KeeperHub Integration (sequential: M-13 then M-14)
| Module | Package | What to Build |
|--------|---------|---------------|
| M-13 | integrations/keeperhub | `KeeperHubTx` — guaranteed transaction submission |
| M-14 | integrations/keeperhub | `KeeperHubSettlement` — payment + reputation write settlement (depends on M-12, M-13) |

### Layer 6 — Worker Agents (parallel tasks, then shell)
| Module | Package | What to Build |
|--------|---------|---------------|
| M-15 | agents/worker | `PoolIndexerTask` — indexes Uniswap pool swap events |
| M-16 | agents/worker | `WalletSummarizerTask` — LLM-powered wallet activity summary |
| M-17 | agents/worker | `TokenFactCheckerTask` — analyzes token contracts for safety |
| M-18 | agents/worker | `WorkerAgent` — shell that orchestrates tasks, payments, proofs |

### Layer 7 — Reputation Agent (parallel modules, then shell)
| Module | Package | What to Build |
|--------|---------|---------------|
| M-19 | agents/reputation | `ReputationIndexer` — subscribes to 0G DA for work proofs |
| M-20 | agents/reputation | `ReputationScorer` — scores worker output vs ground truth |
| M-21 | agents/reputation | `ReputationWatchdog` — anomaly detection (gaming, sybil, copycat) |
| M-22 | agents/reputation | `ReputationAgent` — shell orchestrating all 3 modules |

### Layer 8 — Client Agent (after Layers 5-7)
| Module | Package | What to Build |
|--------|---------|---------------|
| M-23 | agents/client | `ClientAgent` — simulated end-user that buys worker services |

### Layer 9 — MCP Server (after Layer 6)
| Module | Package | What to Build |
|--------|---------|---------------|
| M-24 | mcp-server | MCP server exposing workers as callable tools |

### Layer 10 — Frontend (parallel, after Layers 6-7)
| Module | Package | What to Build |
|--------|---------|---------------|
| M-25 | frontend | Next.js API routes (`/api/workers`, `/api/scores`, `/api/activity`, `/api/stats`) |
| M-26 | frontend | Worker List page + Worker Detail page + WorkerCard component |
| M-27 | frontend | Score Timeline chart (Recharts line chart) |
| M-28 | frontend | Live Activity Feed component |
| M-29 | frontend | Reputation-Aware Worker Selector (the demo climax component) |

### Layer 11 — Orchestration (after all agents)
| Module | Package | What to Build |
|--------|---------|---------------|
| M-30 | scripts | Cold-start seed script — creates 25 workers with varied profiles |
| M-31 | scripts | Orchestrator — starts entire system |
| M-32 | scripts | Demo script — timed 3-minute demo sequence |

### Layer 12 — Submission (last)
| Module | Package | What to Build |
|--------|---------|---------------|
| M-33 | root | Final README.md with deployed addresses + demo link |
| M-34 | root | FEEDBACK.md (required for Uniswap prize) |
| M-35 | root | KEEPERHUB_FEEDBACK.md (required for KeeperHub prize) |

---

## Integration Notes for Coding Agents

### 0G SDK
- Package: `@0glabs/0g-ts-sdk`
- If the SDK API doesn't match expectations, implement with `// TODO` markers and a mock fallback
- Storage uses KV operations — think of it like a decentralized Redis
- Compute is OpenAI-compatible (POST with model, messages, temperature)
- DA is publish/subscribe — think of it like a decentralized Kafka

### Uniswap Trading API
- Base URL: `https://trading-api.gateway.uniswap.org/v1/`
- Endpoints: `POST /quote`, `POST /swap`
- Requires API key in `x-api-key` header
- Use viem for transaction signing after getting the swap calldata

### KeeperHub API
- Base URL: `https://api.keeperhub.com/v1` (configurable)
- Submit pre-signed transactions for guaranteed execution
- If API docs aren't available, design a clean interface and mock it
- Log all KeeperHub interactions — we need this for KEEPERHUB_FEEDBACK.md

### Message Bus
- In-process EventEmitter-based pub/sub (NOT networked)
- All agents register on the same MessageBus singleton
- Messages are typed via `AgentMessage<T>` from `@agentnet/types`
- Topics: `task-request`, `task-result`, `payment`, `score-update`, `heartbeat`

### Smart Contracts
- Deploy target: 0G Chain Testnet
- Use Hardhat for compilation, testing, and deployment
- After deployment, update `packages/config/src/chains.ts` with addresses

---

## Context Prompt for Coding Agents

Copy this prefix before any module-specific prompt:

```
You are building a module for AgentNet, a decentralized AI agent swarm
on 0G Chain for the ETHGlobal OpenAgents hackathon.

Project: TypeScript monorepo (pnpm + Turborepo)
Chain: 0G Chain Testnet (EVM-compatible)
Key packages: viem (blockchain), vitest (testing), zod (validation)

IMPORTANT RULES:
- Import types from @agentnet/types (never redefine them)
- Import config from @agentnet/config (never read process.env directly)
- Use named exports (no default exports except React components)
- Add JSDoc comments on all public methods
- Write at least 3 unit tests with Vitest
- Handle errors with descriptive messages (include module + function name)
- If an external SDK is unavailable, implement with TODO markers + mock fallback
- Barrel export everything public from src/index.ts

Your module: [M-XX — Module Name]
Files to create: [exact paths from IMPLEMENTATION_PLAN.md]
Dependencies: [list from the module spec]
```

Append this suffix:

```
After implementation:
1. Verify no TypeScript errors: pnpm typecheck
2. Run tests: pnpm --filter <package> test
3. Commit: git commit -m "feat(M-XX): <description>"
```

---

## Quick Commands

```bash
# Install all dependencies
pnpm install

# Type-check everything
pnpm typecheck

# Run all tests
pnpm test

# Run tests for one package
pnpm --filter @agentnet/core test

# Build everything
pnpm build

# Deploy contracts
pnpm --filter contracts deploy

# Seed the ecosystem
pnpm seed

# Start everything
pnpm start

# Run the demo
pnpm demo
```

---

## Critical Path

If you're deciding what to work on, prioritize this chain — everything else branches off it:

```
M-01 (Scaffold) → M-04 (Types) → M-06 (Agent Base) → M-08/09 (0G Storage/Compute)
→ M-15 (Pool Indexer) → M-18 (Worker Agent Shell) → M-22 (Rep Agent Shell)
→ M-31 (Orchestrator) → M-32 (Demo Script)
```

---

## What Not To Do

- **Don't install ethers.js** — we use viem exclusively
- **Don't create your own types** — use `@agentnet/types`
- **Don't read process.env** — use `@agentnet/config`
- **Don't use default exports** — named exports only
- **Don't skip tests** — minimum 3 per module
- **Don't build out of order** — check layer dependencies first
- **Don't hardcode addresses** — use config for contract addresses and endpoints
- **Don't use console.log** — use the agent's `this.logger` (via AgentBase)
