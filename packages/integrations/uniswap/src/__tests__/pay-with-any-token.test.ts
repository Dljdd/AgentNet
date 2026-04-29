import { describe, it, expect, vi, afterEach } from "vitest";
import { PayWithAnyToken } from "../pay-with-any-token.js";
import { MockUniswapSwapClient } from "../swap.js";
import type { WalletClient } from "viem";
import type { PaymentChallenge } from "@agentnet/types";

// Mock viem at the top level so vi.mocked works inside tests
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(),
  };
});

vi.mock("@agentnet/config", () => ({
  getConfig: () => ({
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    zgRpcUrl: "http://localhost:8545",
    zgStorageEndpoint: "http://localhost:9000",
    zgComputeEndpoint: "http://localhost:9001",
    zgDAEndpoint: "http://localhost:9002",
    uniswapApiKey: "test-key",
    keeperHubApiKey: "test-key",
    chainId: 16600,
    contracts: { reputationOracle: "", workerRegistry: "" },
  }),
}));

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const WORKER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const PAYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

function makeWallet(address = PAYER): WalletClient {
  return {
    account: { address },
    chain: null,
    sendTransaction: vi.fn().mockResolvedValue("0xsametokentxhash"),
  } as unknown as WalletClient;
}

function makeModule(): { module: PayWithAnyToken; swapClient: MockUniswapSwapClient } {
  const wallet = makeWallet();
  const swapClient = new MockUniswapSwapClient("test-api-key", wallet);
  const module = new PayWithAnyToken(swapClient as any);
  return { module, swapClient };
}

describe("PayWithAnyToken", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createPaymentChallenge()", () => {
    it("returns a PaymentChallenge with all fields", () => {
      const { module } = makeModule();
      const challenge = module.createPaymentChallenge({
        workerAddress: WORKER,
        amount: 1000000n,
        preferredToken: USDC,
        taskId: "task-1",
      });

      expect(challenge.challengeId).toBeTruthy();
      expect(challenge.workerAddress).toBe(WORKER);
      expect(challenge.amount).toBe(1000000n);
      expect(challenge.preferredToken).toBe(USDC);
      expect(challenge.taskId).toBe("task-1");
    });

    it("sets expiresAt ~5 minutes from now", () => {
      const { module } = makeModule();
      const now = Date.now();
      const challenge = module.createPaymentChallenge({
        workerAddress: WORKER,
        amount: 1000000n,
        preferredToken: USDC,
        taskId: "task-1",
      });

      expect(challenge.expiresAt).toBeGreaterThan(now + 295_000);
      expect(challenge.expiresAt).toBeLessThan(now + 305_000);
    });

    it("generates a non-empty challengeId", () => {
      const { module } = makeModule();
      const challenge = module.createPaymentChallenge({
        workerAddress: WORKER,
        amount: 500n,
        preferredToken: USDC,
        taskId: "t1",
      });
      expect(challenge.challengeId.length).toBeGreaterThan(0);
    });
  });

  describe("fulfillChallenge()", () => {
    it("calls walletClient.sendTransaction when tokens are the same and returns a PaymentReceipt", async () => {
      const { module } = makeModule();
      const wallet = makeWallet();

      const challenge = module.createPaymentChallenge({
        workerAddress: WORKER,
        amount: 1000000n,
        preferredToken: USDC,
        taskId: "task-same",
      });

      const receipt = await module.fulfillChallenge({
        challenge,
        payerToken: USDC,
        payerWallet: wallet,
      });

      expect(wallet.sendTransaction).toHaveBeenCalled();
      expect(receipt.txHash).toBeTruthy();
      expect(receipt.from.toLowerCase()).toBe(PAYER.toLowerCase());
      expect(receipt.to).toBe(WORKER);
      expect(receipt.inputToken).toBe(USDC);
      expect(receipt.outputToken).toBe(USDC);
      expect(typeof receipt.amountIn).toBe("bigint");
      expect(typeof receipt.amountOut).toBe("bigint");
      expect(typeof receipt.timestamp).toBe("number");
    });

    it("calls swapClient.executeSwap when tokens differ and returns a PaymentReceipt", async () => {
      const wallet = makeWallet();
      const swapClient = new MockUniswapSwapClient("key", wallet);
      const executeSwapSpy = vi.spyOn(swapClient, "executeSwap");
      const module = new PayWithAnyToken(swapClient as any);

      const challenge = module.createPaymentChallenge({
        workerAddress: WORKER,
        amount: 1000000n,
        preferredToken: USDC,
        taskId: "task-swap",
      });

      const receipt = await module.fulfillChallenge({
        challenge,
        payerToken: WETH,
        payerWallet: wallet,
      });

      expect(executeSwapSpy).toHaveBeenCalled();
      expect(receipt.inputToken).toBe(WETH);
      expect(receipt.outputToken).toBe(USDC);
      expect(receipt.txHash).toBeTruthy();
    });

    it("throws 'expired' when challenge.expiresAt is in the past", async () => {
      const { module } = makeModule();
      const wallet = makeWallet();

      const expiredChallenge: PaymentChallenge = {
        challengeId: "ch-expired",
        workerAddress: WORKER,
        amount: 1000000n,
        preferredToken: USDC,
        taskId: "task-expired",
        expiresAt: Date.now() - 1000,
      };

      await expect(
        module.fulfillChallenge({
          challenge: expiredChallenge,
          payerToken: USDC,
          payerWallet: wallet,
        })
      ).rejects.toThrow(/expired/i);
    });
  });

  describe("verifyPayment()", () => {
    it("returns true when publicClient returns status 'success'", async () => {
      const { createPublicClient } = await import("viem");
      vi.mocked(createPublicClient).mockReturnValue({
        getTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
      } as any);

      const { module } = makeModule();
      const receipt = {
        txHash: "0xsuccesstx",
        from: PAYER,
        to: WORKER,
        amountIn: 1000000n,
        amountOut: 1000000n,
        inputToken: USDC,
        outputToken: USDC,
        timestamp: Date.now(),
      };

      const result = await module.verifyPayment(receipt);
      expect(result).toBe(true);
    });

    it("returns false when publicClient returns status 'reverted'", async () => {
      const { createPublicClient } = await import("viem");
      vi.mocked(createPublicClient).mockReturnValue({
        getTransactionReceipt: vi.fn().mockResolvedValue({ status: "reverted" }),
      } as any);

      const { module } = makeModule();
      const receipt = {
        txHash: "0xrevertedtx",
        from: PAYER,
        to: WORKER,
        amountIn: 1000000n,
        amountOut: 1000000n,
        inputToken: USDC,
        outputToken: USDC,
        timestamp: Date.now(),
      };

      const result = await module.verifyPayment(receipt);
      expect(result).toBe(false);
    });
  });
});
