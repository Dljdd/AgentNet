# KeeperHub Integration Feedback

**Project:** AgentNet — ETHGlobal OpenAgents 2026
**Integration:** KeeperHub for guaranteed on-chain reputation writes and payment settlement

---

## How KeeperHub Is Used in AgentNet

AgentNet uses KeeperHub in two critical places where transaction execution must be guaranteed:

### 1. Reputation Score Writes

Every time the Reputation Agent scores a worker's output, it must write the score to the `ReputationOracle` contract on 0G Chain. If this transaction is dropped or fails, the worker's score is never updated — breaking the entire reputation system.

```typescript
// packages/integrations/keeperhub/src/index.ts
const tx = await keeperHub.submitTransaction({
  to: REPUTATION_ORACLE_ADDRESS,
  data: encodeFunctionData({
    abi: REPUTATION_ORACLE_ABI,
    functionName: "updateScore",
    args: [workerAddress, accuracy, timeliness, uptime],
  }),
  gasLimit: 200_000n,
  maxRetries: 3,
  executionWindow: 60,
});
```

KeeperHub ensures this write lands even if the 0G testnet RPC is temporarily congested or the first broadcast attempt fails.

### 2. Payment Settlement

When a Client pays a Worker via the x402 payment flow, the settlement transaction (an ERC-20 transfer or Uniswap swap + transfer) must be guaranteed to land within a defined window. Without this, a Worker could deliver a task result without receiving payment.

```typescript
const receipt = await keeperHub.submitSettlement({
  from: clientAddress,
  to: workerAddress,
  token: preferredToken,
  amount: feePerTask,
  deadline: Math.floor(Date.now() / 1000) + 120,
});
```

KeeperHub's execution window guarantee means workers can trust payment delivery and deliver task results without holding escrow on-chain themselves.

---

## Integration Experience

Setting up KeeperHub took about 2 hours from zero to first successful submission. The API is REST-based and works naturally with server-side TypeScript agent code.

The key integration points:
1. Set `KEEPERHUB_API_KEY` in `.env`
2. Wrap the transaction in a `KeeperHubTx` or `KeeperHubSettlement` class
3. Submit and receive a `keeperId` for monitoring

```typescript
// packages/integrations/keeperhub/src/index.ts
export class KeeperHubTx {
  constructor(private apiKey: string, private baseUrl: string) {}

  async submit(params: {
    to: string;
    data: string;
    gasLimit: bigint;
    executionWindow?: number;
    maxRetries?: number;
  }): Promise<{ keeperId: string; status: string }> {
    const resp = await fetch(`${this.baseUrl}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify({
        to: params.to,
        data: params.data,
        gasLimit: params.gasLimit.toString(),
        executionWindow: params.executionWindow ?? 60,
        maxRetries: params.maxRetries ?? 3,
      }),
    });
    return resp.json();
  }
}
```

---

## What Worked Well

**The "submit and forget" model is perfect for agent workflows.** Agents are event-driven — they don't want to block waiting for transaction confirmations. KeeperHub's async submission returns a `keeperId` immediately, and agents can check status later or just trust the guaranteed execution window.

**The REST API was easy to call from TypeScript.** Standard JSON over HTTP, no custom SDK required. We were able to integrate it in an afternoon.

**Execution windows are a great primitive for agent payment SLAs.** Workers can advertise "I'll deliver results once payment is confirmed within 60 seconds" — and KeeperHub makes that promise credible.

---

## What Could Be Better

**🐛 Bug / Documentation Gap: No mention of 0G Chain support anywhere in the docs.**

This was the most painful friction point we hit. AgentNet runs entirely on the 0G Chain Testnet (Chain ID 16602, RPC `https://evmrpc-testnet.0g.ai`). When we integrated KeeperHub, we could find zero documentation — not a single page, example, or changelog entry — confirming whether 0G Chain is a supported network. The supported networks list in the KeeperHub docs only covers mainnet EVM chains (Ethereum, Base, Arbitrum, Optimism) and a small set of testnets (Sepolia, Base Sepolia). 0G is not mentioned.

This left us in a genuinely ambiguous state: is our integration broken, or is 0G just undocumented? We had to assume it worked and ship with that uncertainty. A simple addition to the network support matrix — even just "0G Chain: experimental / not yet supported / coming soon" — would have saved us hours of second-guessing. If it is not supported, we needed to know upfront so we could architect a fallback (e.g., bridging to a supported chain for keeper execution, or using a different guarantee mechanism for 0G-native transactions).

**Actionable request:** Add a supported networks page with explicit chain IDs and RPC endpoints. Flag unsupported chains clearly so builders don't spend integration time on a path that won't work.

---

**No webhook / push notification for execution confirmation.** We currently poll `GET /transactions/{keeperId}` every 5 seconds to check status. A webhook on `executed` or `failed` events would let agents react instantly without polling overhead.

**No TypeScript SDK.** We wrote our own typed wrapper around the REST API. An official `@keeperhub/sdk` package with TypeScript types, retry logic, and event emitters would reduce integration time significantly.

**Error messages could be more specific.** When a transaction fails, the API returns `{ status: "failed", error: "execution reverted" }` without the revert reason. Including the decoded revert reason (when available) would make debugging much faster.

**Rate limits are not documented.** We hit a `429 Too Many Requests` during our seed script (which submits ~25 transactions sequentially). It wasn't clear what the rate limit was or how to handle backoff correctly.

**No testnet KeeperHub environment.** Like Uniswap, all integration testing had to go against the production API. A staging environment pointing at Sepolia/testnet infrastructure would let us test the full flow end-to-end without real consequences.

---

## MCP Server Integration Notes

AgentNet exposes workers as MCP tools via `@modelcontextprotocol/sdk`. KeeperHub fits naturally into this architecture: when an MCP tool call triggers a task, KeeperHub guarantees that the resulting payment and reputation write land on-chain even if the MCP session ends before confirmation.

This means Claude (or any MCP client) can call `check_token { tokenAddress: "0x..." }`, the task executes, the worker gets paid, and the score updates — all guaranteed by KeeperHub — without the MCP client needing to wait for on-chain confirmation.

---

## Feature Requests

1. **TypeScript SDK** — `@keeperhub/sdk` with typed request/response types and built-in polling/webhook helpers.

2. **Webhook support** — `POST` callback URL on transaction execution/failure.

3. **Testnet environment** — A staging API pointing at Sepolia or other test networks.

4. **Batch submission** — Submit multiple transactions in one API call with sequential or parallel execution options. Useful for seeding scripts and reputation batch updates.

5. **Decoded revert reasons** — Include the ABI-decoded revert reason in failed transaction responses.

6. **Rate limit headers** — Include `X-RateLimit-Remaining` and `X-RateLimit-Reset` in all responses.

---

## Documentation Quality

Good overview, but missing:
- A TypeScript code example (only curl examples currently)
- Clear rate limit documentation
- Webhook setup guide
- Guidance on handling `failed` states and manual retry strategies

---

## Overall Rating

**4 / 5**

KeeperHub solved a real problem in AgentNet: making on-chain writes reliable in an agent context where transaction confirmation is asynchronous. The REST API is clean and the core concept maps perfectly to agent payment + reputation workflows. The main gaps (SDK, webhooks, testnet) are expected for a product at this stage.
