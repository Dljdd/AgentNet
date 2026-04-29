import { describe, it, expect } from "vitest";
import type {
  AgentConfig,
  AgentStatus,
  AgentType,
  TaskRequest,
  TaskResult,
  ReputationScore,
  ScoreUpdate,
  PaymentChallenge,
  PaymentRequest,
  PaymentReceipt,
  AgentMessage,
  StorageRecord,
  WorkProof,
  DAEvent,
  WorkerListItem,
  ActivityEvent,
} from "../index.js";

describe("AgentConfig", () => {
  it("constructs with all required fields", () => {
    const config: AgentConfig = {
      id: "agent-1",
      type: "worker",
      wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    };
    expect(config.id).toBe("agent-1");
    expect(config.type).toBe("worker");
    expect(config.wallet).toMatch(/^0x/);
    expect(config.privateKey).toMatch(/^0x/);
  });

  it("accepts all AgentType values", () => {
    const types: AgentType[] = ["worker", "reputation", "client"];
    for (const type of types) {
      const config: AgentConfig = { id: "a", type, wallet: "0x1", privateKey: "0x2" };
      expect(config.type).toBe(type);
    }
  });
});

describe("AgentStatus", () => {
  it("accepts all valid status values", () => {
    const statuses: AgentStatus[] = ["idle", "working", "error", "offline"];
    expect(statuses).toHaveLength(4);
  });
});

describe("TaskRequest", () => {
  it("constructs with all required fields", () => {
    const req: TaskRequest = {
      id: "task-1",
      type: "wallet-summarizer",
      params: { address: "0xabc" },
      requester: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      maxFee: 1000000n,
      paymentToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    };
    expect(req.id).toBe("task-1");
    expect(req.type).toBe("wallet-summarizer");
    expect(req.params).toEqual({ address: "0xabc" });
    expect(typeof req.maxFee).toBe("bigint");
    expect(req.maxFee).toBe(1000000n);
  });
});

describe("TaskResult", () => {
  it("constructs with all required fields", () => {
    const result: TaskResult = {
      id: "result-1",
      taskId: "task-1",
      workerId: "worker-1",
      result: { summary: "test" },
      proof: "0xdeadbeef",
      timestamp: Date.now(),
    };
    expect(result.id).toBe("result-1");
    expect(result.taskId).toBe("task-1");
    expect(result.workerId).toBe("worker-1");
    expect(result.proof).toMatch(/^0x/);
    expect(typeof result.timestamp).toBe("number");
  });
});

describe("ReputationScore", () => {
  it("constructs with all numeric fields", () => {
    const score: ReputationScore = {
      accuracy: 9000,
      timeliness: 8500,
      uptime: 9900,
      composite: 9133,
      totalJobs: 42,
      lastUpdated: Date.now(),
    };
    expect(score.accuracy).toBe(9000);
    expect(score.composite).toBe(9133);
    expect(score.totalJobs).toBe(42);
  });
});

describe("ScoreUpdate", () => {
  it("constructs with all required fields", () => {
    const update: ScoreUpdate = {
      agentAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      score: {
        accuracy: 9000,
        timeliness: 8500,
        uptime: 9900,
        composite: 9133,
        totalJobs: 42,
        lastUpdated: Date.now(),
      },
      evidenceUri: "ipfs://QmTest",
    };
    expect(update.agentAddress).toMatch(/^0x/);
    expect(update.evidenceUri).toBe("ipfs://QmTest");
    expect(typeof update.score.composite).toBe("number");
  });
});

describe("PaymentChallenge", () => {
  it("constructs with all required fields", () => {
    const challenge: PaymentChallenge = {
      challengeId: "ch-1",
      workerAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      amount: 500000n,
      preferredToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      taskId: "task-1",
      expiresAt: Date.now() + 300_000,
    };
    expect(challenge.challengeId).toBe("ch-1");
    expect(typeof challenge.amount).toBe("bigint");
    expect(challenge.expiresAt).toBeGreaterThan(Date.now());
  });
});

describe("PaymentRequest", () => {
  it("constructs with all required fields", () => {
    const req: PaymentRequest = {
      from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      amount: 1000000n,
      inputToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      outputToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    };
    expect(req.from).toMatch(/^0x/);
    expect(req.to).toMatch(/^0x/);
    expect(typeof req.amount).toBe("bigint");
  });
});

describe("PaymentReceipt", () => {
  it("constructs with all required fields", () => {
    const receipt: PaymentReceipt = {
      txHash: "0xabc123",
      from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      amountIn: 1000000n,
      amountOut: 500000000000000000n,
      inputToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      outputToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      timestamp: Date.now(),
    };
    expect(receipt.txHash).toMatch(/^0x/);
    expect(typeof receipt.amountIn).toBe("bigint");
    expect(typeof receipt.amountOut).toBe("bigint");
    expect(typeof receipt.timestamp).toBe("number");
  });
});

describe("AgentMessage", () => {
  it("constructs with all required fields", () => {
    const msg: AgentMessage<{ hello: string }> = {
      id: "msg-1",
      type: "heartbeat",
      from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      payload: { hello: "world" },
      timestamp: Date.now(),
      signature: "",
    };
    expect(msg.id).toBe("msg-1");
    expect(msg.type).toBe("heartbeat");
    expect(msg.payload).toEqual({ hello: "world" });
    expect(typeof msg.timestamp).toBe("number");
    expect(msg.timestamp).toBeGreaterThan(0);
  });

  it("accepts all MessageType values", () => {
    const types = ["task-request", "task-result", "payment", "score-update", "heartbeat"] as const;
    expect(types).toHaveLength(5);
  });
});

describe("StorageRecord", () => {
  it("constructs with all required fields", () => {
    const record: StorageRecord = {
      key: "my-key",
      value: "my-value",
      namespace: "test-ns",
    };
    expect(record.key).toBe("my-key");
    expect(record.value).toBe("my-value");
    expect(record.namespace).toBe("test-ns");
  });
});

describe("WorkProof", () => {
  it("constructs with all required fields", () => {
    const proof: WorkProof = {
      workerId: "worker-1",
      taskId: "task-1",
      resultHash: "0xdeadbeef",
      timestamp: Date.now(),
    };
    expect(proof.workerId).toBe("worker-1");
    expect(proof.resultHash).toMatch(/^0x/);
    expect(typeof proof.timestamp).toBe("number");
  });
});

describe("DAEvent", () => {
  it("constructs with all required fields", () => {
    const event: DAEvent = {
      type: "WorkProof",
      data: {
        workerId: "worker-1",
        taskId: "task-1",
        resultHash: "0xdeadbeef",
        timestamp: Date.now(),
      },
      blockHeight: 100,
    };
    expect(event.type).toBe("WorkProof");
    expect(event.blockHeight).toBe(100);
    expect(event.data.workerId).toBe("worker-1");
  });
});

describe("WorkerListItem", () => {
  it("constructs with all required fields", () => {
    const item: WorkerListItem = {
      address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      status: "idle",
      score: {
        accuracy: 9000,
        timeliness: 8500,
        uptime: 9900,
        composite: 9133,
        totalJobs: 42,
        lastUpdated: Date.now(),
      },
      capabilities: ["wallet-summarizer", "pool-indexer"],
      feePerTask: "0.01",
    };
    expect(item.address).toMatch(/^0x/);
    expect(item.status).toBe("idle");
    expect(item.capabilities).toHaveLength(2);
  });
});

describe("ActivityEvent", () => {
  it("constructs with all required fields", () => {
    const event: ActivityEvent = {
      id: "ev-1",
      type: "task",
      summary: "Worker completed a task",
      actors: ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"],
      timestamp: Date.now(),
      txHash: "0xabc123",
    };
    expect(event.id).toBe("ev-1");
    expect(event.type).toBe("task");
    expect(event.actors).toHaveLength(1);
    expect(event.txHash).toMatch(/^0x/);
  });

  it("txHash is optional", () => {
    const event: ActivityEvent = {
      id: "ev-2",
      type: "score",
      summary: "Score updated",
      actors: [],
      timestamp: Date.now(),
    };
    expect(event.txHash).toBeUndefined();
  });
});
