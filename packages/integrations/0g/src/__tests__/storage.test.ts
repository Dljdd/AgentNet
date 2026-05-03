import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZGStorage } from "../storage.js";

// Mock the 0G SDK so tests run offline and instantly.
// ZGStorage's fallback path (in-memory Map) is exercised when SDK calls fail.
vi.mock("@0glabs/0g-ts-sdk", () => ({
  KvClient: vi.fn().mockImplementation(() => ({
    getValue: vi.fn().mockRejectedValue(new Error("mock: offline")),
    newIterator: vi.fn(),
  })),
  Indexer: vi.fn().mockImplementation(() => ({
    selectNodes: vi.fn().mockRejectedValue(new Error("mock: offline")),
  })),
  Batcher: vi.fn(),
  getFlowContract: vi.fn(),
}));

vi.mock("ethers", () => ({
  ethers: {
    JsonRpcProvider: vi.fn(),
    Wallet: vi.fn().mockReturnValue({}),
    id: (s: string) => `0xmock_${s}`,
    encodeBase64: (b: Uint8Array) => Buffer.from(b).toString("base64"),
  },
}));

vi.mock("@agentnet/config", () => ({
  getConfig: () => ({
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    zgRpcUrl: "http://localhost:8545",
    zgStorageEndpoint: "http://localhost:9000",
    zgKvEndpoint: "http://localhost:6789",
    zgFlowContract: "0x0000000000000000000000000000000000000001",
    zgComputeEndpoint: "http://localhost:9001",
    zgDAEndpoint: "http://localhost:9002",
    uniswapApiKey: "test-key",
    keeperHubApiKey: "test-key",
    chainId: 16600,
    contracts: { reputationOracle: "", workerRegistry: "" },
  }),
}));

describe("ZGStorage (in-memory fallback)", () => {
  let storage: ZGStorage;

  beforeEach(() => {
    storage = new ZGStorage();
  });

  describe("put()", () => {
    it("returns a non-empty tx hash string", async () => {
      const txHash = await storage.put("ns", "key1", "value1");
      expect(txHash).toBeTruthy();
      expect(typeof txHash).toBe("string");
      expect(txHash.length).toBeGreaterThan(0);
    });
  });

  describe("get()", () => {
    it("returns null for a missing key", async () => {
      const result = await storage.get("ns", "nonexistent");
      expect(result).toBeNull();
    });

    it("returns the correct value after put()", async () => {
      await storage.put("ns", "mykey", "myvalue");
      const result = await storage.get("ns", "mykey");
      expect(result).toBe("myvalue");
    });

    it("isolates keys by namespace", async () => {
      await storage.put("ns1", "key", "val1");
      await storage.put("ns2", "key", "val2");
      expect(await storage.get("ns1", "key")).toBe("val1");
      expect(await storage.get("ns2", "key")).toBe("val2");
    });
  });

  describe("list()", () => {
    it("returns all records in a namespace", async () => {
      await storage.put("listns", "a", "1");
      await storage.put("listns", "b", "2");
      await storage.put("other", "c", "3");

      const records = await storage.list("listns");
      expect(records).toHaveLength(2);
      expect(records.map((r) => r.key).sort()).toEqual(["a", "b"]);
    });

    it("filters by prefix when provided", async () => {
      await storage.put("prefns", "foo/1", "a");
      await storage.put("prefns", "foo/2", "b");
      await storage.put("prefns", "bar/1", "c");

      const records = await storage.list("prefns", "foo/");
      expect(records).toHaveLength(2);
      expect(records.every((r) => r.key.startsWith("foo/"))).toBe(true);
    });

    it("each record has correct namespace field", async () => {
      await storage.put("nscheck", "k", "v");
      const [record] = await storage.list("nscheck");
      expect(record.namespace).toBe("nscheck");
    });
  });

  describe("appendLog() + readLog()", () => {
    it("round-trips log entries", async () => {
      await storage.appendLog("log1", "entry-a");
      await storage.appendLog("log1", "entry-b");

      const entries = await storage.readLog("log1");
      expect(entries).toEqual(["entry-a", "entry-b"]);
    });

    it("readLog() with fromIndex skips earlier entries", async () => {
      await storage.appendLog("log2", "0");
      await storage.appendLog("log2", "1");
      await storage.appendLog("log2", "2");

      const entries = await storage.readLog("log2", 1);
      expect(entries).toEqual(["1", "2"]);
    });

    it("appendLog() returns a non-empty tx hash", async () => {
      const tx = await storage.appendLog("log3", "data");
      expect(tx).toBeTruthy();
      expect(tx.length).toBeGreaterThan(0);
    });
  });

  describe("storeJSON() + getJSON()", () => {
    it("round-trips an object", async () => {
      const obj = { foo: 42, bar: ["a", "b"] };
      await storage.storeJSON("jns", "jkey", obj);
      const result = await storage.getJSON<typeof obj>("jns", "jkey");
      expect(result).toEqual(obj);
    });

    it("getJSON() returns null on missing key", async () => {
      const result = await storage.getJSON("jns", "missing");
      expect(result).toBeNull();
    });
  });
});
