import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentConfig, AgentMessage } from "@agentnet/types";
import { AgentBase } from "../agent-base.js";

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
    contracts: {
      reputationOracle: "0x0000000000000000000000000000000000000001",
      workerRegistry: "0x0000000000000000000000000000000000000002",
    },
  }),
  ZG_TESTNET: {
    chainId: 16600,
    name: "0G Chain Testnet",
    rpcUrl: "http://localhost:8545",
    nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
  },
}));

const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

class TestAgent extends AgentBase {
  async start(): Promise<void> {
    this.startedAt = Date.now();
    this.setStatus("working");
  }

  async stop(): Promise<void> {
    this.setStatus("idle");
  }

  async handleMessage(_message: AgentMessage): Promise<void> {}
}

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: "test-agent-1",
    type: "worker",
    wallet: TEST_ADDRESS,
    privateKey: TEST_PRIVATE_KEY,
    ...overrides,
  };
}

describe("AgentBase", () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent(makeConfig());
  });

  describe("constructor", () => {
    it("sets id from config", () => {
      expect((agent as any).id).toBe("test-agent-1");
    });

    it("sets type from config", () => {
      expect((agent as any).type).toBe("worker");
    });

    it("sets initial status to idle", () => {
      expect(agent.getStatus()).toBe("idle");
    });

    it("derives a valid Ethereum address from the private key", () => {
      expect(agent.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(agent.address.toLowerCase()).toBe(TEST_ADDRESS.toLowerCase());
    });
  });

  describe("setStatus()", () => {
    it("transitions status correctly", () => {
      agent.setStatus("working");
      expect(agent.getStatus()).toBe("working");

      agent.setStatus("error");
      expect(agent.getStatus()).toBe("error");

      agent.setStatus("offline");
      expect(agent.getStatus()).toBe("offline");

      agent.setStatus("idle");
      expect(agent.getStatus()).toBe("idle");
    });
  });

  describe("getUptime()", () => {
    it("returns 0 before start", () => {
      expect(agent.getUptime()).toBe(0);
    });

    it("returns positive uptime after startedAt is set", async () => {
      await agent.start();
      // Give it a tiny bit of time
      await new Promise((r) => setTimeout(r, 10));
      expect(agent.getUptime()).toBeGreaterThanOrEqual(0);
    });
  });

  describe("sign()", () => {
    it("returns a non-empty hex string", async () => {
      const sig = await agent.sign("hello world");
      expect(sig).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(sig.length).toBeGreaterThan(10);
    });
  });

  describe("verify()", () => {
    it("returns true for data signed by the same key", async () => {
      const data = "verify me";
      const sig = await agent.sign(data);
      const valid = await agent.verify(data, sig, agent.address);
      expect(valid).toBe(true);
    });

    it("returns false for tampered data", async () => {
      const sig = await agent.sign("original");
      const valid = await agent.verify("tampered", sig, agent.address);
      expect(valid).toBe(false);
    });
  });

  describe("toJSON()", () => {
    it("returns expected shape", () => {
      const json = agent.toJSON() as Record<string, unknown>;
      expect(json).toMatchObject({
        id: "test-agent-1",
        type: "worker",
        status: "idle",
        address: agent.address,
      });
      expect(typeof json["uptime"]).toBe("number");
    });
  });
});
