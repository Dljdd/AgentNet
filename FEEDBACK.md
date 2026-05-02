# Uniswap Integration Feedback

**Project:** AgentNet — ETHGlobal OpenAgents 2026
**Integration:** Uniswap Trading API + x402 (pay-with-any-token for AI agent payments)

---

## Which Uniswap Packages Were Used

- `@uniswap/sdk-core` — Token primitives and type definitions
- Uniswap Trading API (REST, `https://api.uniswap.org/v2/quote` + `https://api.uniswap.org/v2/order`) — routing and swap execution
- Custom `PayWithAnyToken` wrapper — x402-style payment challenges where the payer's token is auto-swapped to the worker's preferred token

---

## What Worked Well

**The Trading API is the right abstraction for agent-to-agent payments.**
In AgentNet, a Worker agent requests payment in WETH, but a Client agent only holds USDC. The Trading API made it trivial to bridge them: we call `/quote` for route discovery and `/order` for execution. No need to touch Uniswap contracts directly.

```typescript
// From packages/integrations/uniswap/src/swap.ts
const result = await this.swapClient.executeSwap({
  tokenIn: payerToken,       // USDC (what client has)
  tokenOut: preferredToken,  // WETH (what worker wants)
  amount: challenge.amount,
  type: "EXACT_OUTPUT",      // pay exactly what the worker expects
  recipient: challenge.workerAddress,
});
```

The `EXACT_OUTPUT` mode is particularly useful for agent payments: the worker specifies a fixed fee and the client doesn't need to do any math — the API figures out how much to debit.

**The API key flow was intuitive.** One env var (`UNISWAP_API_KEY`), one header, done.

**The REST-first design is friendly for server-side TypeScript code.** Since agent processes run as Node.js daemons (no browser), using the REST API directly was simpler than using `@uniswap/widgets` or browser-first packages.

---

## What Was Confusing or Hard

**No TypeScript SDK for the Trading API.** We had to write all the request/response types by hand from reading the OpenAPI docs. A `@uniswap/trading-api-sdk` package would have saved significant time. We made mistakes with `chainId` encoding (string vs number in different endpoints) that took an hour to debug.

**The x402/MPP protocol is not officially documented.** We implemented a custom `PaymentChallenge` pattern inspired by the x402 spec, but had to infer the exact fields from community posts. Official support or a reference implementation would help.

**`EXACT_OUTPUT` route failures on testnet.** On the 0G testnet, many token pairs have no liquidity, so `EXACT_OUTPUT` swaps often return `INSUFFICIENT_LIQUIDITY`. We had to add a fallback to `EXACT_INPUT` mode. It would be helpful if the API returned a richer error code (e.g. `NO_ROUTE` vs `INSUFFICIENT_LIQUIDITY`).

**No sandbox/testnet environment for the Trading API.** All our testing went against the production API with real mainnet quote data, but agent transactions ran on the 0G testnet. This made it impossible to do true end-to-end payment tests without real funds on mainnet.

---

## Feature Requests

1. **`@uniswap/trading-api-sdk`** — Official TypeScript client with typed requests/responses and built-in retries.

2. **Testnet environment** — A staging Trading API that routes quotes through testnet liquidity (Sepolia / Base Sepolia) so developers can test full payment flows without mainnet funds.

3. **x402 reference implementation** — An official `@uniswap/x402` package that implements the payment challenge/fulfillment protocol, so agents can interoperate without each project re-inventing the flow.

4. **Richer error codes** — Structured error objects (not just HTTP 400 + message string) so we can programmatically distinguish "no route", "slippage too high", "token not supported", etc.

5. **Webhook support for swap settlement** — Currently we poll the transaction receipt. A webhook on settlement confirmation would let agent systems react faster without polling overhead.

---

## Documentation Feedback

The Trading API reference at docs.uniswap.org is well-organized. The `/quote` → `/order` flow is clear. However:
- The authentication section could explicitly call out that API keys are required for `/order` but not for `/quote`
- More example code in TypeScript (vs just curl) would help
- The `permit2` signature flow is documented but the examples use ethers.js; viem examples would help since many modern TypeScript projects use viem

---

## Integration Experience Rating

**4 / 5**

The Trading API is genuinely useful for agent payment scenarios. The main friction was the missing TypeScript SDK and testnet environment, which added 2-3 days of extra work. Once those gaps are filled this would be a 5/5 integration experience.
