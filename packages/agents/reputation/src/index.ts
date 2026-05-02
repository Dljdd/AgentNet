// @agentnet/agents-reputation — Reputation Agent shell (M-22)
// Orchestrates the Indexer, Scorer, and Watchdog into a single long-running
// agent that extends AgentBase for lifecycle management.
import { AgentBase } from "@agentnet/core";
import { messageBus } from "@agentnet/core";
import type { AgentConfig, AgentMessage } from "@agentnet/types";
import { ReputationIndexer } from "./modules/indexer";
import { ReputationScorer } from "./modules/scorer";
import { ReputationWatchdog } from "./modules/watchdog";
import type { WatchdogAlert } from "./modules/watchdog";

export { ReputationIndexer } from "./modules/indexer";
export { ReputationScorer } from "./modules/scorer";
export { ReputationWatchdog } from "./modules/watchdog";
export type { ReputationEvent } from "./modules/indexer";
export type { WatchdogAlert } from "./modules/watchdog";

export class ReputationAgent extends AgentBase {
  private indexer: ReputationIndexer;
  private scorer: ReputationScorer;
  private watchdog: ReputationWatchdog;

  constructor(config: AgentConfig) {
    super(config);
    this.indexer = new ReputationIndexer();
    this.scorer = new ReputationScorer();
    this.watchdog = new ReputationWatchdog({
      inactivityThresholdMs: 10 * 60 * 1000,
      lowAccuracyThreshold: 2000,
      checkIntervalMs: 60_000,
    });
  }

  async start(): Promise<void> {
    this.startedAt = Date.now();

    // Wire indexer → scorer + watchdog
    this.indexer.onEvent(async (event) => {
      this.watchdog.observe(event);
      await this.scorer.ingest(event).catch((err) =>
        this.logger.error("Scorer ingest failed", err)
      );
    });

    // Log watchdog alerts
    this.watchdog.onAlert((alert: WatchdogAlert) => {
      if (alert.type === "inactive") {
        this.logger.warn(`Worker inactive for ${Math.round(alert.silentForMs / 60000)}m`, {
          worker: alert.workerAddress,
        });
      } else if (alert.type === "low-accuracy") {
        this.logger.warn(`Worker accuracy ${alert.accuracy}/10000 below threshold`, {
          worker: alert.workerAddress,
          threshold: alert.threshold,
        });
      } else if (alert.type === "recovered") {
        this.logger.info(`Worker recovered`, { worker: alert.workerAddress });
      }
      // Broadcast alert to the message bus so the orchestrator can react
      messageBus.broadcast({
        id: `watchdog-${Date.now()}`,
        type: "heartbeat",
        from: this.id,
        to: "all",
        payload: { alertType: alert.type, ...alert },
        timestamp: Date.now(),
        signature: "",
      });
    });

    this.indexer.start(15_000);
    this.watchdog.start();
    messageBus.register(this.id, (msg) => this.handleMessage(msg));
    this.setStatus("idle");
    this.logger.info("Reputation agent started");
  }

  async stop(): Promise<void> {
    this.indexer.stop();
    this.watchdog.stop();
    // Flush any pending score accumulations to chain
    await this.scorer.flushAll().catch(() => {});
    messageBus.unregister(this.id);
    this.setStatus("offline");
    this.logger.info("Reputation agent stopped");
  }

  async handleMessage(message: AgentMessage): Promise<void> {
    // Reputation agent responds to score-query requests from other agents
    if (message.type === "task-request" && (message.payload as { type?: string })?.type === "score-query") {
      this.logger.debug("Score query received", { from: message.from });
    }
  }
}
