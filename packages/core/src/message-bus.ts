import { EventEmitter } from "node:events";
import type { AgentMessage } from "@agentnet/types";

export class MessageBus {
  private emitter: EventEmitter;
  private static instance: MessageBus;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }

  register(agentId: string, handler: (msg: AgentMessage) => void): void {
    this.emitter.on(agentId, handler);
  }

  unregister(agentId: string): void {
    this.emitter.removeAllListeners(agentId);
  }

  send(message: AgentMessage): void {
    this.emitter.emit(message.to, message);
    this.emitter.emit("all", message);
  }

  broadcast(message: AgentMessage): void {
    for (const agentId of this.getRegisteredAgents()) {
      if (agentId !== message.from) {
        this.emitter.emit(agentId, message);
      }
    }
    this.emitter.emit("all", message);
  }

  onAny(handler: (msg: AgentMessage) => void): void {
    this.emitter.on("all", handler);
  }

  getRegisteredAgents(): string[] {
    return (this.emitter.eventNames() as string[]).filter((n) => n !== "all");
  }
}

export const messageBus = MessageBus.getInstance();
