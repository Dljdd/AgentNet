import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  KeeperHubClient,
  KeeperHubSettlement,
  WORKFLOW_IDS,
} from "./index.js";

// ─── fetch mock helpers ───────────────────────────────────────────────────────

function mockFetch(responses: Array<{ ok: boolean; status?: number; json?: object; text?: string }>) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const r = responses[call++ % responses.length];
    return Promise.resolve({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 401),
      json: () => Promise.resolve(r.json ?? {}),
      text: () => Promise.resolve(r.text ?? ""),
    });
  });
}

// ─── KeeperHubClient (M-13) ───────────────────────────────────────────────────

describe("KeeperHubClient", () => {
  let client: KeeperHubClient;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new KeeperHubClient({
      apiKey: "test-key",
      baseUrl: "https://test.keeperhub.io",
      pollIntervalMs: 10,
      timeoutMs: 5_000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("executeWorkflow", () => {
    it("posts to /api/workflow/:id/execute with input and returns executionId", async () => {
      fetchSpy = mockFetch([{ ok: true, json: { executionId: "exec-abc", status: "running" } }]);
      vi.stubGlobal("fetch", fetchSpy);

      const result = await client.executeWorkflow("workflow-123", { foo: "bar" });

      expect(result.executionId).toBe("exec-abc");
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://test.keeperhub.io/api/workflow/workflow-123/execute");
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body as string)).toEqual({ input: { foo: "bar" } });
      expect((opts.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-key");
    });

    it("returns a stub execution id when no API key is configured", async () => {
      const noKeyClient = new KeeperHubClient({ baseUrl: "https://test.keeperhub.io" });
      const result = await noKeyClient.executeWorkflow("wf-1", {});
      expect(result.executionId).toMatch(/^stub-wf-1-/);
    });

    it("throws on non-ok HTTP response", async () => {
      fetchSpy = mockFetch([{ ok: false, text: "Unauthorized" }]);
      vi.stubGlobal("fetch", fetchSpy);
      await expect(client.executeWorkflow("wf-1", {})).rejects.toThrow(/failed \(401\)/i);
    });
  });

  describe("waitForExecution", () => {
    it("returns immediately for stub executions", async () => {
      const result = await client.waitForExecution("stub-wf-1-12345");
      expect(result.status).toBe("success");
      expect(result.nodeStatuses?.find(n => n.nodeId === "action")?.result?.success).toBe(true);
    });

    it("polls /api/workflows/executions/:id/status until terminal", async () => {
      fetchSpy = mockFetch([
        { ok: true, json: { status: "running" } },
        { ok: true, json: { status: "running" } },
        {
          ok: true,
          json: {
            status: "success",
            nodeStatuses: [{ nodeId: "update-score", status: "success", result: { success: true, transactionHash: "0xabc" } }],
          },
        },
      ]);
      vi.stubGlobal("fetch", fetchSpy);

      const result = await client.waitForExecution("exec-1");
      expect(result.status).toBe("success");
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://test.keeperhub.io/api/workflows/executions/exec-1/status");
    });

    it("throws on timeout when execution never completes", async () => {
      const shortTimeout = new KeeperHubClient({
        apiKey: "k",
        baseUrl: "https://test.keeperhub.io",
        pollIntervalMs: 10,
        timeoutMs: 50,
      });
      fetchSpy = mockFetch([{ ok: true, json: { id: "exec-1", status: "running" } }]);
      vi.stubGlobal("fetch", fetchSpy);
      await expect(shortTimeout.waitForExecution("exec-1")).rejects.toThrow(/timed out/i);
    });
  });

  describe("executeAndWait", () => {
    it("calls workflow and returns KeeperReceipt with txHash", async () => {
      fetchSpy = mockFetch([
        { ok: true, json: { executionId: "exec-42" } },
        { ok: true, json: { status: "success", nodeStatuses: [{ nodeId: "trigger", status: "success" }, { nodeId: "update-score", status: "success" }] } },
        { ok: true, json: { execution: { output: { transactionHash: "0xdeadbeef" } } } }, // fetchExecutionTxHash
      ]);
      vi.stubGlobal("fetch", fetchSpy);

      const receipt = await client.executeAndWait("wf-id", { a: "1" });
      expect(receipt.executionId).toBe("exec-42");
      expect(receipt.txHash).toBe("0xdeadbeef");
      expect(receipt.success).toBe(true);
    });

    it("throws when execution status is error", async () => {
      fetchSpy = mockFetch([
        { ok: true, json: { executionId: "exec-fail" } },
        {
          ok: true,
          json: {
            id: "exec-fail",
            status: "error",
            errorContext: { error: "Contract call failed: onlyAuthorized" },
          },
        },
      ]);
      vi.stubGlobal("fetch", fetchSpy);

      await expect(client.executeAndWait("wf-id", {})).rejects.toThrow(/failed/i);
    });
  });
});

// ─── KeeperHubSettlement (M-14) ───────────────────────────────────────────────

describe("KeeperHubSettlement", () => {
  let settlement: KeeperHubSettlement;
  let fetchSpy: ReturnType<typeof vi.fn>;

  const successResponse = {
    ok: true,
    json: {
      status: "success",
      nodeStatuses: [
        { nodeId: "trigger", status: "success" },
        { nodeId: "action", status: "success" },
      ],
    },
  };

  const txHashResponse = {
    ok: true,
    json: { execution: { output: { transactionHash: "0xcafe" } } },
  };

  beforeEach(() => {
    settlement = new KeeperHubSettlement(
      new KeeperHubClient({
        apiKey: "test-key",
        baseUrl: "https://test.keeperhub.io",
        pollIntervalMs: 10,
        timeoutMs: 5_000,
      })
    );
    fetchSpy = mockFetch([
      { ok: true, json: { executionId: "exec-ok" } },
      successResponse,
      txHashResponse, // fetchExecutionTxHash
    ]);
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("settleReputationUpdate", () => {
    it("triggers the reputation-update workflow with correct params", async () => {
      const receipt = await settlement.settleReputationUpdate({
        agentAddress: "0x1234567890123456789012345678901234567890",
        accuracy: 9000,
        timeliness: 8500,
        uptime: 9200,
      });

      expect(receipt.success).toBe(true);
      expect(receipt.txHash).toBe("0xcafe");

      const [execUrl, execOpts] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(execUrl).toMatch(/\/api\/workflow\/.*\/execute/);
      expect(execUrl).toContain(WORKFLOW_IDS.reputationUpdate);
      const body = JSON.parse(execOpts.body as string);
      expect(body.input).toEqual({
        agentAddress: "0x1234567890123456789012345678901234567890",
        accuracy: "9000",
        timeliness: "8500",
        uptime: "9200",
      });
    });

    it("coerces score numbers to strings in the input payload", async () => {
      await settlement.settleReputationUpdate({
        agentAddress: "0xdeadbeef00000000000000000000000000000000",
        accuracy: 0,
        timeliness: 10000,
        uptime: 5000,
      });

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.input.accuracy).toBe("0");
      expect(body.input.timeliness).toBe("10000");
    });
  });

  describe("settlePayment", () => {
    it("triggers the payment-settle workflow with correct params", async () => {
      const receipt = await settlement.settlePayment({
        recipientAddress: "0xworker",
        amount: "10.5",
        tokenAddress: "0xtoken",
        tokenSymbol: "USDC",
      });

      expect(receipt.success).toBe(true);

      const [execUrl, execOpts] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(execUrl).toMatch(/\/api\/workflow\/.*\/execute/);
      expect(execUrl).toContain(WORKFLOW_IDS.paymentSettle);
      const body = JSON.parse(execOpts.body as string);
      expect(body.input).toEqual({
        recipientAddress: "0xworker",
        amount: "10.5",
        tokenAddress: "0xtoken",
        tokenSymbol: "USDC",
      });
    });
  });

  describe("settleFromReceipt", () => {
    it("converts a PaymentReceipt to settlement params", async () => {
      const receipt = {
        txHash: "0xoriginal",
        from: "0xclient",
        to: "0xworker",
        amountIn: 1000000n,
        amountOut: 10_000000000000000000n, // 10 tokens (18 decimals)
        inputToken: "0xusdc",
        outputToken: "0xweth",
        timestamp: Date.now(),
      };

      await settlement.settleFromReceipt(receipt, "0xworker", "WETH");

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.input.amount).toBe("10");
      expect(body.input.recipientAddress).toBe("0xworker");
      expect(body.input.tokenSymbol).toBe("WETH");
    });

    it("formats fractional token amounts correctly", async () => {
      const receipt = {
        txHash: "0x1",
        from: "0xa",
        to: "0xb",
        amountIn: 0n,
        amountOut: 1_500000000000000000n, // 1.5 tokens
        inputToken: "0x1",
        outputToken: "0x2",
        timestamp: 0,
      };

      await settlement.settleFromReceipt(receipt, "0xb");

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.input.amount).toBe("1.5");
    });
  });
});

// ─── WORKFLOW_IDS constants ───────────────────────────────────────────────────

describe("WORKFLOW_IDS", () => {
  it("has the provisioned KeeperHub workflow IDs as defaults", () => {
    expect(WORKFLOW_IDS.reputationUpdate).toBe("gtpk3bflrnoihktuoa8ci");
    expect(WORKFLOW_IDS.paymentSettle).toBe("qpkwci7tw0dr3dlnjv0d6");
  });
});
