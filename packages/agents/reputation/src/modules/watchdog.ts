// Reputation Watchdog — M-21
// Monitors the live agent network for workers that go silent (no WorkProofs
// received within a configurable window) and emits alerts so the orchestrator
// can deactivate them on-chain or page an operator.
import type { ReputationEvent } from "./indexer";

export type WatchdogAlert =
  | { type: "inactive"; workerAddress: string; silentForMs: number }
  | { type: "low-accuracy"; workerAddress: string; accuracy: number; threshold: number }
  | { type: "recovered"; workerAddress: string };

export interface WatchdogOptions {
  inactivityThresholdMs?: number;  // default 10 min
  lowAccuracyThreshold?: number;   // default 2000 / 10000
  checkIntervalMs?: number;        // default 60s
}

export class ReputationWatchdog {
  private lastSeen: Map<string, number> = new Map();
  private accuracyBuffer: Map<string, number[]> = new Map();
  private alertedWorkers: Set<string> = new Set();
  private alertHandlers: Array<(alert: WatchdogAlert) => void> = [];
  private checkInterval?: ReturnType<typeof setInterval>;

  private inactivityThresholdMs: number;
  private lowAccuracyThreshold: number;
  private checkIntervalMs: number;

  constructor(options: WatchdogOptions = {}) {
    this.inactivityThresholdMs = options.inactivityThresholdMs ?? 10 * 60 * 1000;
    this.lowAccuracyThreshold = options.lowAccuracyThreshold ?? 2000;
    this.checkIntervalMs = options.checkIntervalMs ?? 60_000;
  }

  onAlert(handler: (alert: WatchdogAlert) => void): void {
    this.alertHandlers.push(handler);
  }

  /** Feed a live ReputationEvent so the watchdog can track liveness. */
  observe(event: ReputationEvent): void {
    const addr = event.workerAddress;
    this.lastSeen.set(addr, Date.now());

    const buf = this.accuracyBuffer.get(addr) ?? [];
    buf.push(event.valid ? 1 : 0);
    if (buf.length > 20) buf.shift();
    this.accuracyBuffer.set(addr, buf);

    // Clear alert if worker was previously flagged as inactive
    if (this.alertedWorkers.has(addr)) {
      this.alertedWorkers.delete(addr);
      this.emit({ type: "recovered", workerAddress: addr });
    }
  }

  start(): void {
    this.checkInterval = setInterval(() => this.check(), this.checkIntervalMs);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  private check(): void {
    const now = Date.now();

    for (const [addr, last] of this.lastSeen.entries()) {
      const silentForMs = now - last;

      if (silentForMs > this.inactivityThresholdMs && !this.alertedWorkers.has(addr)) {
        this.alertedWorkers.add(addr);
        this.emit({ type: "inactive", workerAddress: addr, silentForMs });
        continue;
      }

      const buf = this.accuracyBuffer.get(addr) ?? [];
      if (buf.length >= 5) {
        const recentAccuracy = Math.round(
          (buf.reduce((s, v) => s + v, 0) / buf.length) * 10000
        );
        if (recentAccuracy < this.lowAccuracyThreshold && !this.alertedWorkers.has(addr)) {
          this.alertedWorkers.add(addr);
          this.emit({
            type: "low-accuracy",
            workerAddress: addr,
            accuracy: recentAccuracy,
            threshold: this.lowAccuracyThreshold,
          });
        }
      }
    }
  }

  private emit(alert: WatchdogAlert): void {
    for (const handler of this.alertHandlers) handler(alert);
  }
}
