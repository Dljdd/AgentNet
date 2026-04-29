import { describe, it, expect } from "vitest";
import { createMessage, signMessage, verifyMessage } from "../messaging.js";

const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
// Corresponding address for Hardhat account #0
const TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

describe("createMessage()", () => {
  it("produces a message with correct id, type, from, to, payload", () => {
    const payload = { hello: "world" };
    const msg = createMessage("heartbeat", TEST_ADDRESS, "0x1234", payload);
    expect(msg.type).toBe("heartbeat");
    expect(msg.from).toBe(TEST_ADDRESS);
    expect(msg.to).toBe("0x1234");
    expect(msg.payload).toEqual(payload);
  });

  it("generates a non-empty id", () => {
    const msg = createMessage("heartbeat", TEST_ADDRESS, "0x1234", {});
    expect(msg.id).toBeTruthy();
    expect(msg.id.length).toBeGreaterThan(0);
  });

  it("sets a non-zero timestamp", () => {
    const before = Date.now();
    const msg = createMessage("heartbeat", TEST_ADDRESS, "0x1234", {});
    const after = Date.now();
    expect(msg.timestamp).toBeGreaterThanOrEqual(before);
    expect(msg.timestamp).toBeLessThanOrEqual(after);
  });

  it("sets signature to empty string", () => {
    const msg = createMessage("heartbeat", TEST_ADDRESS, "0x1234", {});
    expect(msg.signature).toBe("");
  });

  it("generates unique ids for consecutive messages", () => {
    const msg1 = createMessage("heartbeat", TEST_ADDRESS, "0x1", {});
    const msg2 = createMessage("heartbeat", TEST_ADDRESS, "0x2", {});
    expect(msg1.id).not.toBe(msg2.id);
  });
});

describe("signMessage()", () => {
  it("fills in a non-empty signature", async () => {
    const msg = createMessage("heartbeat", TEST_ADDRESS, "0x1234", { data: "test" });
    const signed = await signMessage(msg, TEST_PRIVATE_KEY);
    expect(signed.signature).toBeTruthy();
    expect(signed.signature.length).toBeGreaterThan(0);
    expect(signed.signature).toMatch(/^0x/);
  });

  it("does not mutate the original message", async () => {
    const msg = createMessage("heartbeat", TEST_ADDRESS, "0x1234", { data: "test" });
    const originalSig = msg.signature;
    await signMessage(msg, TEST_PRIVATE_KEY);
    expect(msg.signature).toBe(originalSig);
  });

  it("returns a new message object", async () => {
    const msg = createMessage("heartbeat", TEST_ADDRESS, "0x1234", { data: "test" });
    const signed = await signMessage(msg, TEST_PRIVATE_KEY);
    expect(signed).not.toBe(msg);
  });
});

describe("verifyMessage()", () => {
  it("returns true for a correctly signed message", async () => {
    const msg = createMessage("heartbeat", TEST_ADDRESS, "0x1234", { data: "test" });
    const signed = await signMessage(msg, TEST_PRIVATE_KEY);
    const valid = await verifyMessage(signed);
    expect(valid).toBe(true);
  });

  it("returns false for a tampered payload", async () => {
    const msg = createMessage("task-request", TEST_ADDRESS, "0x1234", { amount: 100 });
    const signed = await signMessage(msg, TEST_PRIVATE_KEY);
    const tampered = { ...signed, payload: { amount: 9999 } };
    const valid = await verifyMessage(tampered);
    expect(valid).toBe(false);
  });

  it("returns false for a message with empty signature", async () => {
    const msg = createMessage("heartbeat", TEST_ADDRESS, "0x1234", { data: "test" });
    const valid = await verifyMessage(msg);
    expect(valid).toBe(false);
  });
});
