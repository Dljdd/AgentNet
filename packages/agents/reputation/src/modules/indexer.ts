// Reputation Indexer — M-19
// Watches the 0G DA layer for WorkProof events emitted by WorkerAgents after
// task completion. Each proof is validated, decoded, and emitted as a
// ReputationEvent for the Scorer to consume.
import { ZGDA } from "@agentnet/integrations-0g";
import type { DAEvent, WorkProof } from "@agentnet/types";

export interface ReputationEvent {
  workerId: string;
  workerAddress: string;
  taskId: string;
  resultHash: string;
  timestamp: number;
  valid: boolean;
}

export class ReputationIndexer {
  private daClient: ZGDA;
  private handlers: Array<(event: ReputationEvent) => void> = [];
  private pollInterval?: ReturnType<typeof setInterval>;
  private lastSeenBlock = 0;

  constructor(daClient?: ZGDA) {
    this.daClient = daClient ?? new ZGDA();
  }

  /** Register a handler called for every new validated ReputationEvent. */
  onEvent(handler: (event: ReputationEvent) => void): void {
    this.handlers.push(handler);
  }

  /** Start polling the DA layer for new WorkProof events. */
  start(pollIntervalMs = 15_000): void {
    this.poll().catch(() => {});
    this.pollInterval = setInterval(() => {
      this.poll().catch(() => {});
    }, pollIntervalMs);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  private async poll(): Promise<void> {
    try {
      const events: DAEvent[] = await this.daClient.getEvents(this.lastSeenBlock);
      for (const event of events) {
        if (event.type !== "work-proof") continue;
        const proof = event.data as WorkProof;
        const repEvent = this.decode(proof, event.blockHeight);
        this.lastSeenBlock = Math.max(this.lastSeenBlock, event.blockHeight);
        for (const handler of this.handlers) handler(repEvent);
      }
    } catch {
      // DA layer unavailable — silently skip this poll cycle
    }
  }

  private decode(proof: WorkProof, _blockHeight: number): ReputationEvent {
    // Extract address from workerId format "worker-0xADDRESS"
    const workerAddress = proof.workerId.startsWith("worker-")
      ? proof.workerId.slice(7)
      : proof.workerId;

    return {
      workerId: proof.workerId,
      workerAddress,
      taskId: proof.taskId,
      resultHash: proof.resultHash,
      timestamp: proof.timestamp,
      valid: proof.resultHash.startsWith("0x") && proof.resultHash.length === 66,
    };
  }
}
