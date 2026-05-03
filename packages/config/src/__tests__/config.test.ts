import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ZG_TESTNET, CONTRACT_ADDRESSES, TESTNET_TOKENS } from "../chains.js";

const REQUIRED_ENV_VARS = [
  "PRIVATE_KEY",
  "ZG_RPC_URL",
  "ZG_STORAGE_ENDPOINT",
  "ZG_COMPUTE_ENDPOINT",
  "ZG_DA_ENDPOINT",
  "UNISWAP_API_KEY",
  "KEEPERHUB_API_KEY",
  "CHAIN_ID",
];

const VALID_ENV: Record<string, string> = {
  PRIVATE_KEY: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  ZG_RPC_URL: "https://evmrpc-testnet.0g.ai",
  ZG_STORAGE_ENDPOINT: "https://storage-testnet.0g.ai",
  ZG_COMPUTE_ENDPOINT: "https://compute-testnet.0g.ai",
  ZG_DA_ENDPOINT: "https://da-testnet.0g.ai",
  UNISWAP_API_KEY: "test-uniswap-key",
  KEEPERHUB_API_KEY: "test-keeper-key",
  CHAIN_ID: "16600",
  REPUTATION_ORACLE_ADDRESS: "0x1234000000000000000000000000000000000001",
  WORKER_REGISTRY_ADDRESS: "0x1234000000000000000000000000000000000002",
};

const ALL_VARS = [...REQUIRED_ENV_VARS, "REPUTATION_ORACLE_ADDRESS", "WORKER_REGISTRY_ADDRESS"];

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ALL_VARS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  // Reset module cache so getConfig() re-reads process.env on each import
  vi.resetModules();
});

afterEach(() => {
  for (const key of ALL_VARS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
  vi.resetModules();
});

describe("getConfig()", () => {
  it("throws a descriptive error when required env vars are missing", async () => {
    const { getConfig } = await import("../index.js");
    expect(() => getConfig()).toThrow(/Missing required environment variables/);
  });

  it("error message lists missing variable names", async () => {
    const { getConfig } = await import("../index.js");
    try {
      getConfig();
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as Error).message).toMatch(/PRIVATE_KEY|ZG_RPC_URL/);
    }
  });

  it("returns a correctly shaped config when all vars are present", async () => {
    for (const [k, v] of Object.entries(VALID_ENV)) process.env[k] = v;
    const { getConfig } = await import("../index.js");
    const config = getConfig();
    expect(config).toMatchObject({
      privateKey: VALID_ENV["PRIVATE_KEY"],
      zgRpcUrl: VALID_ENV["ZG_RPC_URL"],
      zgStorageEndpoint: VALID_ENV["ZG_STORAGE_ENDPOINT"],
      zgComputeEndpoint: VALID_ENV["ZG_COMPUTE_ENDPOINT"],
      zgDAEndpoint: VALID_ENV["ZG_DA_ENDPOINT"],
      uniswapApiKey: VALID_ENV["UNISWAP_API_KEY"],
      keeperHubApiKey: VALID_ENV["KEEPERHUB_API_KEY"],
      chainId: 16600,
    });
    expect(config.contracts).toBeDefined();
    expect("reputationOracle" in config.contracts).toBe(true);
    expect("workerRegistry" in config.contracts).toBe(true);
  });

  it("throws when a single required var is missing", async () => {
    for (const [k, v] of Object.entries(VALID_ENV)) process.env[k] = v;
    delete process.env["PRIVATE_KEY"];
    const { getConfig } = await import("../index.js");
    expect(() => getConfig()).toThrow(/Missing required environment variables/);
  });
});

describe("ZG_TESTNET", () => {
  it("has chainId 16602", () => {
    expect(ZG_TESTNET.chainId).toBe(16602);
  });

  it("has a non-empty rpcUrl", () => {
    expect(ZG_TESTNET.rpcUrl).toBeTruthy();
    expect(ZG_TESTNET.rpcUrl.length).toBeGreaterThan(0);
  });

  it("has correct native currency", () => {
    expect(ZG_TESTNET.nativeCurrency.symbol).toBe("OG");
    expect(ZG_TESTNET.nativeCurrency.decimals).toBe(18);
  });
});

describe("CONTRACT_ADDRESSES", () => {
  it("has reputationOracle key", () => {
    expect("reputationOracle" in CONTRACT_ADDRESSES).toBe(true);
  });

  it("has workerRegistry key", () => {
    expect("workerRegistry" in CONTRACT_ADDRESSES).toBe(true);
  });
});

describe("TESTNET_TOKENS", () => {
  it("has USDC key", () => {
    expect(TESTNET_TOKENS.USDC).toBeTruthy();
    expect(TESTNET_TOKENS.USDC).toMatch(/^0x/);
  });

  it("has WETH key", () => {
    expect(TESTNET_TOKENS.WETH).toBeTruthy();
    expect(TESTNET_TOKENS.WETH).toMatch(/^0x/);
  });

  it("has USDT key", () => {
    expect(TESTNET_TOKENS.USDT).toBeTruthy();
    expect(TESTNET_TOKENS.USDT).toMatch(/^0x/);
  });
});
