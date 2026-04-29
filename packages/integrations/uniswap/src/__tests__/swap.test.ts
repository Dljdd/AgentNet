import { describe, it, expect, vi, afterEach } from "vitest";
import { MockUniswapSwapClient, UniswapSwapClient } from "../swap.js";
import type { WalletClient } from "viem";

function mockWallet(): WalletClient {
  return {
    account: { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
    chain: null,
    sendTransaction: vi.fn().mockResolvedValue("0xmocktxhash"),
  } as unknown as WalletClient;
}

describe("MockUniswapSwapClient", () => {
  const wallet = mockWallet();
  const client = new MockUniswapSwapClient("test-api-key", wallet);

  describe("getQuote()", () => {
    it("returns { quote, route, priceImpact, gasEstimate }", async () => {
      const result = await client.getQuote({
        tokenIn: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        tokenOut: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        amount: 1000000n,
        type: "EXACT_INPUT",
      });

      expect(typeof result.quote).toBe("bigint");
      expect(result.route).toBeDefined();
      expect(typeof result.priceImpact).toBe("number");
      expect(typeof result.gasEstimate).toBe("bigint");
    });
  });

  describe("executeSwap()", () => {
    it("returns { txHash, amountIn, amountOut }", async () => {
      const result = await client.executeSwap({
        tokenIn: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        tokenOut: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        amount: 1000000n,
        type: "EXACT_INPUT",
      });

      expect(typeof result.txHash).toBe("string");
      expect(result.txHash.length).toBeGreaterThan(0);
      expect(typeof result.amountIn).toBe("bigint");
      expect(typeof result.amountOut).toBe("bigint");
    });
  });

  describe("getSupportedTokens()", () => {
    it("returns an array of { address, symbol, decimals }", async () => {
      const tokens = await client.getSupportedTokens();
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
      for (const token of tokens) {
        expect(typeof token.address).toBe("string");
        expect(typeof token.symbol).toBe("string");
        expect(typeof token.decimals).toBe("number");
      }
    });
  });
});

describe("UniswapSwapClient error handling (fetch mocked)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeClient() {
    return new UniswapSwapClient("test-api-key", mockWallet());
  }

  describe("getQuote()", () => {
    it("throws 'No route found' when response has no quote field", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ route: null }), // no quote field
          text: async () => "",
        })
      );

      const client = makeClient();
      await expect(
        client.getQuote({
          tokenIn: "0xaaa",
          tokenOut: "0xbbb",
          amount: 1000n,
          type: "EXACT_INPUT",
        })
      ).rejects.toThrow("No route found");
    });

    it("throws with status code when fetch returns non-ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          text: async () => "Unauthorized",
        })
      );

      const client = makeClient();
      await expect(
        client.getQuote({
          tokenIn: "0xaaa",
          tokenOut: "0xbbb",
          amount: 1000n,
          type: "EXACT_INPUT",
        })
      ).rejects.toThrow("403");
    });
  });

  describe("executeSwap()", () => {
    it("throws 'Price impact too high' when priceImpact > 5", async () => {
      // First call (getQuote inside executeSwap) returns high priceImpact
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            quote: "1000000",
            route: { mock: true },
            priceImpact: 7.5,
            gasEstimate: "150000",
          }),
          text: async () => "",
        })
      );

      const client = makeClient();
      await expect(
        client.executeSwap({
          tokenIn: "0xaaa",
          tokenOut: "0xbbb",
          amount: 1000n,
          type: "EXACT_INPUT",
        })
      ).rejects.toThrow("Price impact too high");
    });
  });
});
