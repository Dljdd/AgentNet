import { describe, it, expect, vi } from "vitest";
import { MockZGDA } from "../da.js";
import type { WorkProof, DAEvent } from "@agentnet/types";

function makeProof(overrides: Partial<WorkProof> = {}): WorkProof {
  return {
    workerId: "worker-1",
    taskId: "task-1",
    resultHash: "0xdeadbeef12345678",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("MockZGDA", () => {
  describe("publishWorkProof()", () => {
    it("returns { txHash: string, blockHeight: number }", async () => {
      const da = new MockZGDA();
      const result = await da.publishWorkProof(makeProof());
      expect(typeof result.txHash).toBe("string");
      expect(result.txHash.length).toBeGreaterThan(0);
      expect(typeof result.blockHeight).toBe("number");
      expect(result.blockHeight).toBeGreaterThan(0);
    });

    it("blockHeight increments on each publish", async () => {
      const da = new MockZGDA();
      const r1 = await da.publishWorkProof(makeProof({ taskId: "t1" }));
      const r2 = await da.publishWorkProof(makeProof({ taskId: "t2" }));
      expect(r2.blockHeight).toBe(r1.blockHeight + 1);
    });
  });

  describe("subscribe()", () => {
    it("callback fires when publishWorkProof() is called", async () => {
      const da = new MockZGDA();
      const received: DAEvent[] = [];
      da.subscribe((event) => received.push(event));

      await da.publishWorkProof(makeProof());
      expect(received).toHaveLength(1);
      expect(received[0].data.workerId).toBe("worker-1");
    });

    it("unsubscribe() stops the callback from firing", async () => {
      const da = new MockZGDA();
      const received: DAEvent[] = [];
      const unsub = da.subscribe((event) => received.push(event));

      await da.publishWorkProof(makeProof({ taskId: "before" }));
      unsub();
      await da.publishWorkProof(makeProof({ taskId: "after" }));

      expect(received).toHaveLength(1);
      expect(received[0].data.taskId).toBe("before");
    });
  });

  describe("getEvents()", () => {
    it("returns events within the given block range", async () => {
      const da = new MockZGDA();
      await da.publishWorkProof(makeProof({ taskId: "t1" })); // block 1
      await da.publishWorkProof(makeProof({ taskId: "t2" })); // block 2
      await da.publishWorkProof(makeProof({ taskId: "t3" })); // block 3

      const events = await da.getEvents(2, 3);
      expect(events).toHaveLength(2);
      expect(events.map((e) => e.data.taskId)).toEqual(["t2", "t3"]);
    });
  });

  describe("publishBatch()", () => {
    it("publishes multiple proofs and increments blockHeight once", async () => {
      const da = new MockZGDA();
      const proofs = [
        makeProof({ taskId: "b1", resultHash: "0xaaa1" }),
        makeProof({ taskId: "b2", resultHash: "0xaaa2" }),
        makeProof({ taskId: "b3", resultHash: "0xaaa3" }),
      ];

      const before = await da.getLatestBlock();
      const result = await da.publishBatch(proofs);
      const after = await da.getLatestBlock();

      expect(result.blockHeight).toBe(before + 1);
      expect(after).toBe(before + 1);

      // All three events should exist at the same block height
      const events = await da.getEvents(result.blockHeight, result.blockHeight);
      expect(events).toHaveLength(3);
    });
  });

  describe("verifyProof()", () => {
    it("returns true for a proof that was published", async () => {
      const da = new MockZGDA();
      const proof = makeProof({ resultHash: "0xverifiable1234" });
      const { txHash } = await da.publishWorkProof(proof);
      const verified = await da.verifyProof(proof, txHash);
      expect(verified).toBe(true);
    });

    it("returns false for a proof that was not published", async () => {
      const da = new MockZGDA();
      const proof = makeProof({ resultHash: "0xneverPublished" });
      const verified = await da.verifyProof(proof, "0xfaketx");
      expect(verified).toBe(false);
    });
  });
});
