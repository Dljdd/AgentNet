import type { AgentConfig, AgentMessage, AgentStatus, AgentType } from "@agentnet/types";
import { getConfig, ZG_TESTNET } from "@agentnet/config";
import { createWalletClient, http, verifyMessage } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { WalletClient } from "viem";

const zgTestnetChain = {
  id: ZG_TESTNET.chainId,
  name: ZG_TESTNET.name,
  nativeCurrency: ZG_TESTNET.nativeCurrency,
  rpcUrls: {
    default: { http: [ZG_TESTNET.rpcUrl] },
    public: { http: [ZG_TESTNET.rpcUrl] },
  },
} as const;

export abstract class AgentBase {
  protected id: string;
  protected type: AgentType;
  protected status: AgentStatus;
  protected wallet: WalletClient;
  public address: string;
  protected startedAt: number = 0;
  protected logger: {
    info: (msg: string, data?: unknown) => void;
    warn: (msg: string, data?: unknown) => void;
    error: (msg: string, data?: unknown) => void;
    debug: (msg: string, data?: unknown) => void;
  };

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.type = config.type;
    this.status = "idle";

    const account = privateKeyToAccount(config.privateKey as `0x${string}`);
    this.wallet = createWalletClient({
      account,
      chain: zgTestnetChain,
      transport: http(getConfig().zgRpcUrl),
    });
    this.address = account.address;

    const prefix = `[${this.type}:${this.id}]`;
    this.logger = {
      info: (msg, data) =>
        data !== undefined
          ? console.log(`${prefix} ${msg}`, data)
          : console.log(`${prefix} ${msg}`),
      warn: (msg, data) =>
        data !== undefined
          ? console.warn(`${prefix} ${msg}`, data)
          : console.warn(`${prefix} ${msg}`),
      error: (msg, data) =>
        data !== undefined
          ? console.error(`${prefix} ${msg}`, data)
          : console.error(`${prefix} ${msg}`),
      debug: (msg, data) =>
        data !== undefined
          ? console.debug(`${prefix} ${msg}`, data)
          : console.debug(`${prefix} ${msg}`),
    };
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract handleMessage(message: AgentMessage): Promise<void>;

  getStatus(): AgentStatus {
    return this.status;
  }

  setStatus(status: AgentStatus): void {
    this.logger.info(`Status transition: ${this.status} → ${status}`);
    this.status = status;
  }

  getUptime(): number {
    if (this.startedAt === 0) return 0;
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }

  async sign(data: string): Promise<string> {
    const account = this.wallet.account;
    if (!account) throw new Error("No account attached to wallet");
    return this.wallet.signMessage({ account, message: data });
  }

  async verify(data: string, signature: string, address: string): Promise<boolean> {
    return verifyMessage({
      address: address as `0x${string}`,
      message: data,
      signature: signature as `0x${string}`,
    });
  }

  toJSON(): object {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      address: this.address,
      uptime: this.getUptime(),
    };
  }
}
