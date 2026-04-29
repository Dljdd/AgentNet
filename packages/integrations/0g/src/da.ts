import { EventEmitter } from "events";
import type { WorkProof, DAEvent } from "@agentnet/types";
import { getConfig } from "@agentnet/config";

// TODO(0g-sdk): If @0glabs/0g-ts-sdk ships a DA client, replace the HTTP/WS
// calls below with its typed API (e.g. DAClient.publish, DAClient.subscribe).

export class ZGDA {
  private readonly endpoint: string;
  private readonly privateKey: string;

  constructor(endpoint?: string, privateKey?: string) {
    if (endpoint && privateKey) {
      this.endpoint = endpoint;
      this.privateKey = privateKey;
    } else {
      const cfg = getConfig();
      this.endpoint = cfg.zgStorageEndpoint;
      this.privateKey = cfg.privateKey;
    }
  }

  // ---------------------------------------------------------------------------
  // Publishing
  // ---------------------------------------------------------------------------

  async publishWorkProof(proof: WorkProof): Promise<{ txHash: string; blockHeight: number }> {
    const response = await fetch(`${this.endpoint}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.privateKey}`,
      },
      body: JSON.stringify(proof),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `0G DA publishWorkProof failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`
      );
    }

    const data = (await response.json()) as { txHash: string; blockHeight: number };
    return { txHash: data.txHash, blockHeight: data.blockHeight };
  }

  async publishBatch(proofs: WorkProof[]): Promise<{ txHash: string; blockHeight: number }> {
    const response = await fetch(`${this.endpoint}/publish/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.privateKey}`,
      },
      body: JSON.stringify(proofs),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `0G DA publishBatch failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`
      );
    }

    const data = (await response.json()) as { txHash: string; blockHeight: number };
    return { txHash: data.txHash, blockHeight: data.blockHeight };
  }

  // ---------------------------------------------------------------------------
  // Subscribing
  // ---------------------------------------------------------------------------

  subscribe(callback: (event: DAEvent) => void): () => void {
    const wsUrl = this.endpoint.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsUrl}/subscribe`);

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data as string) as DAEvent;
        callback(event);
      } catch {
        // malformed message — ignore
      }
    };

    return () => ws.close();
  }

  async getEvents(fromBlock: number, toBlock?: number): Promise<DAEvent[]> {
    const to = toBlock ?? "latest";
    const response = await fetch(`${this.endpoint}/events?from=${fromBlock}&to=${to}`, {
      headers: { Authorization: `Bearer ${this.privateKey}` },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `0G DA getEvents failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`
      );
    }

    return (await response.json()) as DAEvent[];
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  async getLatestBlock(): Promise<number> {
    const response = await fetch(`${this.endpoint}/block/latest`, {
      headers: { Authorization: `Bearer ${this.privateKey}` },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `0G DA getLatestBlock failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`
      );
    }

    const data = (await response.json()) as { blockNumber: number };
    return data.blockNumber;
  }

  async verifyProof(proof: WorkProof, txHash: string): Promise<boolean> {
    const response = await fetch(`${this.endpoint}/verify/${txHash}`, {
      headers: { Authorization: `Bearer ${this.privateKey}` },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `0G DA verifyProof failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`
      );
    }

    const data = (await response.json()) as { resultHash: string };
    return data.resultHash === proof.resultHash;
  }
}

// ---------------------------------------------------------------------------
// Mock — local pub/sub via EventEmitter for tests and dev
// ---------------------------------------------------------------------------

export class MockZGDA extends EventEmitter {
  private blockHeight = 0;
  private events: DAEvent[] = [];

  async publishWorkProof(proof: WorkProof): Promise<{ txHash: string; blockHeight: number }> {
    this.blockHeight += 1;
    const txHash = `0xmock_${proof.resultHash.slice(0, 16)}_${this.blockHeight}`;
    const event: DAEvent = { type: "WorkProof", data: proof, blockHeight: this.blockHeight };
    this.events.push(event);
    this.emit("event", event);
    return { txHash, blockHeight: this.blockHeight };
  }

  async publishBatch(proofs: WorkProof[]): Promise<{ txHash: string; blockHeight: number }> {
    this.blockHeight += 1;
    const combined = proofs.map((p) => p.resultHash).join("");
    const txHash = `0xmock_batch_${Buffer.from(combined).toString("hex").slice(0, 16)}_${this.blockHeight}`;
    for (const proof of proofs) {
      const event: DAEvent = { type: "WorkProof", data: proof, blockHeight: this.blockHeight };
      this.events.push(event);
      this.emit("event", event);
    }
    return { txHash, blockHeight: this.blockHeight };
  }

  subscribe(callback: (event: DAEvent) => void): () => void {
    this.on("event", callback);
    return () => this.off("event", callback);
  }

  async getEvents(fromBlock: number, toBlock?: number): Promise<DAEvent[]> {
    const to = toBlock ?? this.blockHeight;
    return this.events.filter((e) => e.blockHeight >= fromBlock && e.blockHeight <= to);
  }

  async getLatestBlock(): Promise<number> {
    return this.blockHeight;
  }

  async verifyProof(proof: WorkProof, txHash: string): Promise<boolean> {
    return this.events.some(
      (e) => e.data.resultHash === proof.resultHash && txHash.includes(proof.resultHash.slice(0, 16))
    );
  }
}
