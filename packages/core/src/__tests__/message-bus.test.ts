import { describe, it, expect, beforeEach } from "vitest";
import { MessageBus } from "../message-bus.js";
import { createMessage } from "../messaging.js";
import type { AgentMessage } from "@agentnet/types";

function freshBus(): MessageBus {
  // Bypass the singleton to get a clean instance per test
  return new (MessageBus as any)();
}

describe("MessageBus", () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = freshBus();
  });

  describe("register() + send()", () => {
    it("delivers a message to the correct handler", () => {
      const received: AgentMessage[] = [];
      bus.register("agent-a", (msg) => received.push(msg));

      const msg = createMessage("heartbeat", "agent-b", "agent-a", { ping: true });
      bus.send(msg);

      expect(received).toHaveLength(1);
      expect(received[0].to).toBe("agent-a");
    });

    it("does not deliver to wrong recipient", () => {
      const receivedA: AgentMessage[] = [];
      const receivedB: AgentMessage[] = [];
      bus.register("agent-a", (msg) => receivedA.push(msg));
      bus.register("agent-b", (msg) => receivedB.push(msg));

      const msg = createMessage("heartbeat", "agent-c", "agent-a", {});
      bus.send(msg);

      expect(receivedA).toHaveLength(1);
      expect(receivedB).toHaveLength(0);
    });
  });

  describe("unregister()", () => {
    it("stops delivery after unregister", () => {
      const received: AgentMessage[] = [];
      bus.register("agent-a", (msg) => received.push(msg));

      bus.unregister("agent-a");
      bus.send(createMessage("heartbeat", "agent-b", "agent-a", {}));

      expect(received).toHaveLength(0);
    });
  });

  describe("broadcast()", () => {
    it("delivers to all agents except sender", () => {
      const receivedA: AgentMessage[] = [];
      const receivedB: AgentMessage[] = [];
      const receivedC: AgentMessage[] = [];
      bus.register("agent-a", (msg) => receivedA.push(msg));
      bus.register("agent-b", (msg) => receivedB.push(msg));
      bus.register("agent-c", (msg) => receivedC.push(msg));

      const msg = createMessage("heartbeat", "agent-a", "broadcast", {});
      bus.broadcast(msg);

      expect(receivedA).toHaveLength(0); // sender excluded
      expect(receivedB).toHaveLength(1);
      expect(receivedC).toHaveLength(1);
    });
  });

  describe("onAny()", () => {
    it("receives every sent message", () => {
      const all: AgentMessage[] = [];
      bus.onAny((msg) => all.push(msg));
      bus.register("agent-a", () => {});

      bus.send(createMessage("heartbeat", "sender", "agent-a", {}));
      bus.send(createMessage("task-request", "sender", "agent-a", {}));

      expect(all).toHaveLength(2);
    });

    it("also receives broadcast messages", () => {
      const all: AgentMessage[] = [];
      bus.onAny((msg) => all.push(msg));
      bus.register("agent-a", () => {});

      const msg = createMessage("heartbeat", "sender", "broadcast", {});
      bus.broadcast(msg);

      expect(all).toHaveLength(1);
    });
  });

  describe("getRegisteredAgents()", () => {
    it("returns the correct list of registered agents", () => {
      bus.register("agent-x", () => {});
      bus.register("agent-y", () => {});

      const agents = bus.getRegisteredAgents();
      expect(agents).toContain("agent-x");
      expect(agents).toContain("agent-y");
      expect(agents).not.toContain("all");
    });

    it("excludes unregistered agents", () => {
      bus.register("agent-x", () => {});
      bus.register("agent-y", () => {});
      bus.unregister("agent-x");

      const agents = bus.getRegisteredAgents();
      expect(agents).not.toContain("agent-x");
      expect(agents).toContain("agent-y");
    });
  });
});
