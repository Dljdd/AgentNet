# AgentNet

> A swarm of AI agents that get paid by anyone, in any token, for doing onchain work — building their own reputation onchain in the process.

**ETHGlobal OpenAgents Hackathon** | April 24 – May 6, 2026

---

## What Is AgentNet?

AgentNet is a decentralized network of AI agents that perform real onchain work (indexing Uniswap pools, summarizing wallets, fact-checking tokens), get paid in any token via Uniswap's pay-with-any-token flow, and build verifiable reputation scores onchain. A Reputation Agent watches all work, scores accuracy and timeliness using LLM inference on 0G Compute, and publishes scores to the 0G Chain — guaranteed to land via KeeperHub.

## Architecture

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

## Sponsor Integrations

| Sponsor | Integration | What It Does |
|---------|------------|--------------|
| **0G** | Storage, Compute, DA | Agent memory (Storage), LLM inference for scoring (Compute), work-proof broadcasting (DA) |
| **Uniswap** | Trading API + x402/MPP | Pay-with-any-token: clients pay in Token A, workers receive Token B, Uniswap swaps in-flight |
| **KeeperHub** | Guaranteed TX execution | Every reputation write and payment settlement goes through KeeperHub for guaranteed inclusion |

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- Git

### Setup
```bash
git clone https://github.com/Dljdd/AgentNet.git
cd AgentNet
pnpm install
cp .env.example .env
# Fill in your keys in .env
```

### Run
```bash
# (Optional) Deploy fresh contracts — already deployed, addresses in .env
pnpm --filter contracts deploy:0g-testnet

# Seed the ecosystem with 25 workers across 5 reputation profiles
pnpm seed

# Start all agents + message bus orchestration
pnpm start

# In a separate terminal — start the explorer UI
cd packages/frontend && pnpm dev

# Open the explorer
open http://localhost:3000
```

### Demo (scripted 3-minute walkthrough)
```bash
pnpm demo
```

## Contract Addresses (0G Chain Testnet)

| Contract | Address |
|----------|---------|
| ReputationOracle | `0x19139CDE2d0da0B148bE69cD4261AA62B9d4F125` |
| WorkerRegistry | `0xde94A743D06143b08E4B49E3812D570065BEdC51` |

Chain ID: 16602 · RPC: `https://evmrpc-testnet.0g.ai` · Explorer: `https://chainscan-galileo.0g.ai`

## Project Structure

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the full 35-module breakdown.

See [AGENTS.md](./AGENTS.md) for instructions on using coding agents to build modules.

## Tech Stack

- **Language:** TypeScript (Node.js 20+)
- **Monorepo:** pnpm workspaces + Turborepo
- **Contracts:** Solidity 0.8.x, Hardhat
- **Chain:** 0G Chain Testnet
- **Frontend:** Next.js 14, TailwindCSS, Recharts
- **Blockchain:** viem, wagmi

## Team

### Dylan Moraes — [𝕏](https://x.com/dylowisp) | [Telegram](https://t.me/dylanmoraes)
### Dhananjay Joshi — [𝕏](https://x.com/DhananjayBUIDL) | [Telegram](https://t.me/DhananjayBUIDL)
### Rahul Biradar — [𝕏](https://x.com/rahulbiradar_) | [Telegram](https://t.me/Rahulbiradar06)
### Rakesh Kumawat — [𝕏](https://x.com/RakeshKumawattt) | [Telegram](https://t.me/RakeshWeb3)

Built for ETHGlobal OpenAgents 2026.

## License

MIT
