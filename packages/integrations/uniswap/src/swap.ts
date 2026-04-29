import type { WalletClient } from "viem";

const BASE_URL = "https://trading-api.gateway.uniswap.org/v1";

export interface QuoteResult {
  quote: bigint;
  route: unknown;
  priceImpact: number;
  gasEstimate: bigint;
}

export interface SwapResult {
  txHash: string;
  amountIn: bigint;
  amountOut: bigint;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

export interface QuoteParams {
  tokenIn: string;
  tokenOut: string;
  amount: bigint;
  type: "EXACT_INPUT" | "EXACT_OUTPUT";
}

export interface SwapParams extends QuoteParams {
  slippageTolerance?: number;
  recipient?: string;
}

export class UniswapSwapClient {
  private apiKey: string;
  private walletClient: WalletClient;

  constructor(apiKey: string, walletClient: WalletClient) {
    this.apiKey = apiKey;
    this.walletClient = walletClient;
  }

  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    const res = await fetch(`${BASE_URL}/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amount: params.amount.toString(),
        type: params.type,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Quote request failed (${res.status}): ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;

    if (!data?.["quote"]) {
      throw new Error("No route found for token pair");
    }

    return {
      quote: BigInt(data["quote"] as string),
      route: data["route"] ?? null,
      priceImpact: (data["priceImpact"] as number) ?? 0,
      gasEstimate: BigInt((data["gasEstimate"] as string) ?? "0"),
    };
  }

  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const slippageTolerance = params.slippageTolerance ?? 0.5;
    const recipient =
      params.recipient ?? this.walletClient.account?.address;

    if (!recipient) {
      throw new Error("No recipient address: provide one or connect a wallet account");
    }

    const quoteResult = await this.getQuote(params);

    if (quoteResult.priceImpact > 5) {
      throw new Error(
        `Price impact too high: ${quoteResult.priceImpact.toFixed(2)}% exceeds 5% threshold`
      );
    }

    const swapRes = await fetch(`${BASE_URL}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({
        quote: quoteResult.route,
        slippageTolerance,
        recipient,
      }),
    });

    if (!swapRes.ok) {
      const text = await swapRes.text().catch(() => swapRes.statusText);
      if (text.includes("insufficient balance") || swapRes.status === 400) {
        throw new Error(`Swap failed — insufficient balance: ${text}`);
      }
      if (text.includes("expired") || swapRes.status === 410) {
        throw new Error(`Swap failed — quote expired: ${text}`);
      }
      throw new Error(`Swap request failed (${swapRes.status}): ${text}`);
    }

    const swapData = await swapRes.json() as Record<string, unknown>;

    const txHash = await this.walletClient.sendTransaction({
      to: swapData["to"] as `0x${string}`,
      data: swapData["calldata"] as `0x${string}`,
      value: swapData["value"] ? BigInt(swapData["value"] as string) : 0n,
      account: this.walletClient.account!,
      chain: this.walletClient.chain ?? null,
    });

    return {
      txHash,
      amountIn: BigInt((swapData["amountIn"] as string) ?? params.amount.toString()),
      amountOut: BigInt((swapData["amountOut"] as string) ?? quoteResult.quote.toString()),
    };
  }

  async getSupportedTokens(): Promise<TokenInfo[]> {
    const res = await fetch("https://tokens.uniswap.org");

    if (!res.ok) {
      throw new Error(`Failed to fetch token list (${res.status}): ${res.statusText}`);
    }

    const data = await res.json() as Record<string, unknown>;
    const tokens: TokenInfo[] = ((data["tokens"] ?? []) as any[]).map((t: any) => ({
      address: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
    }));

    return tokens;
  }
}

export class MockUniswapSwapClient {
  private walletClient: WalletClient;

  constructor(_apiKey: string, walletClient: WalletClient) {
    this.walletClient = walletClient;
  }

  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    return {
      quote: params.amount,
      route: { mock: true },
      priceImpact: 0.1,
      gasEstimate: 150000n,
    };
  }

  async executeSwap(params: SwapParams): Promise<SwapResult> {
    return {
      txHash: "0xmocktxhash0000000000000000000000000000000000000000000000000000001",
      amountIn: params.amount,
      amountOut: params.amount,
    };
  }

  async getSupportedTokens(): Promise<TokenInfo[]> {
    return [
      { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
      { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 },
      { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", decimals: 18 },
    ];
  }
}
