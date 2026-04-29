import { createPublicClient, encodeFunctionData, http } from "viem";
import type { WalletClient } from "viem";
import { nanoid } from "nanoid";
import type { PaymentChallenge, PaymentReceipt } from "@agentnet/types";
import { getConfig } from "@agentnet/config";
import type { UniswapSwapClient } from "./swap";

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export class PayWithAnyToken {
  private swapClient: UniswapSwapClient;

  constructor(swapClient: UniswapSwapClient) {
    this.swapClient = swapClient;
  }

  createPaymentChallenge(params: {
    workerAddress: string;
    amount: bigint;
    preferredToken: string;
    taskId: string;
  }): PaymentChallenge {
    return {
      challengeId: nanoid(),
      workerAddress: params.workerAddress,
      amount: params.amount,
      preferredToken: params.preferredToken,
      taskId: params.taskId,
      expiresAt: Date.now() + 300_000,
    };
  }

  async fulfillChallenge(params: {
    challenge: PaymentChallenge;
    payerToken: string;
    payerWallet: WalletClient;
  }): Promise<PaymentReceipt> {
    const { challenge, payerToken, payerWallet } = params;

    if (challenge.expiresAt <= Date.now()) {
      throw new Error(`Payment challenge ${challenge.challengeId} has expired`);
    }

    const sameToken =
      payerToken.toLowerCase() === challenge.preferredToken.toLowerCase();

    let txHash: string;
    let amountIn: bigint;
    let amountOut: bigint;

    if (sameToken) {
      const data = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [challenge.workerAddress as `0x${string}`, challenge.amount],
      });

      txHash = await payerWallet.sendTransaction({
        to: payerToken as `0x${string}`,
        data,
        account: payerWallet.account!,
        chain: payerWallet.chain ?? null,
      });

      amountIn = challenge.amount;
      amountOut = challenge.amount;
    } else {
      const result = await this.swapClient.executeSwap({
        tokenIn: payerToken,
        tokenOut: challenge.preferredToken,
        amount: challenge.amount,
        type: "EXACT_OUTPUT",
        recipient: challenge.workerAddress,
      });

      txHash = result.txHash;
      amountIn = result.amountIn;
      amountOut = result.amountOut;
    }

    const from = payerWallet.account?.address ?? "";

    return {
      txHash,
      from,
      to: challenge.workerAddress,
      amountIn,
      amountOut,
      inputToken: payerToken,
      outputToken: challenge.preferredToken,
      timestamp: Date.now(),
    };
  }

  async verifyPayment(receipt: PaymentReceipt): Promise<boolean> {
    const config = getConfig();

    const publicClient = createPublicClient({
      transport: http(config.zgRpcUrl),
    });

    const txReceipt = await publicClient.getTransactionReceipt({
      hash: receipt.txHash as `0x${string}`,
    });

    return txReceipt.status === "success";
  }
}

export default PayWithAnyToken;
