// 0G Storage — KV store backed by the 0G Storage network.
//
// Writes : Batcher (StreamDataBuilder → Indexer.selectNodes → batcher.exec())
//          Each write submits an on-chain tx on 0G Galileo and replicates to
//          storage nodes.  Costs a small amount of OG for gas.
//
// Reads  : KvClient.getValue(streamId, base64Key)
//          Off-chain read directly from the KV node — free and fast.
//
// Config (all have sensible testnet defaults):
//   ZG_STORAGE_ENDPOINT  indexer RPC  https://indexer-storage-testnet-turbo.0g.ai
//   ZG_KV_ENDPOINT       KV node      http://3.101.147.150:6789
//   ZG_FLOW_CONTRACT     Flow addr    0x22E03a6A89B950F1c82ec5e74F8eCa321a105296
//   ZG_RPC_URL           EVM RPC      https://evmrpc-testnet.0g.ai
//
// Fallback: if the SDK call fails the operation falls back to an in-memory Map
// so the rest of the agent pipeline keeps running.

import {
  KvClient,
  Batcher,
  Indexer,
  getFlowContract,
} from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import type { StorageRecord } from "@agentnet/types";
import { getConfig } from "@agentnet/config";

// Testnet defaults — override via env vars.
const DEFAULT_INDEXER = "https://indexer-storage-testnet-turbo.0g.ai";
const DEFAULT_KV      = "http://3.101.147.150:6789";
const DEFAULT_FLOW    = "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296";

type StorageEntry = { value: string; timestamp: number };

export class ZGStorage {
  private readonly indexer: Indexer;
  private readonly kvClient: KvClient;
  private readonly evmRpc: string;
  private readonly signer: ethers.Wallet;
  private readonly fallbackFlowAddr: string;

  // In-memory fallback — mirrors every successful write so reads work
  // immediately (before the KV node indexes the tx) and survive SDK failures.
  private readonly kvFallback = new Map<string, StorageEntry>();

  constructor(opts?: {
    indexerEndpoint?: string;
    kvEndpoint?: string;
    evmRpc?: string;
    privateKey?: string;
    flowContract?: string;
  }) {
    const cfg = getConfig();
    const indexerUrl       = opts?.indexerEndpoint ?? cfg.zgStorageEndpoint ?? DEFAULT_INDEXER;
    const kvUrl            = opts?.kvEndpoint      ?? cfg.zgKvEndpoint      ?? DEFAULT_KV;
    this.evmRpc            = opts?.evmRpc          ?? cfg.zgRpcUrl;
    this.fallbackFlowAddr  = opts?.flowContract    ?? cfg.zgFlowContract   ?? DEFAULT_FLOW;

    const provider = new ethers.JsonRpcProvider(this.evmRpc);
    this.signer    = new ethers.Wallet(opts?.privateKey ?? cfg.privateKey, provider);

    this.indexer  = new Indexer(indexerUrl);
    this.kvClient = new KvClient(kvUrl);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** keccak256(namespace) → stream ID for the KV node. */
  private streamId(namespace: string): string {
    return ethers.id(namespace);
  }

  /** UTF-8 string key → Uint8Array for Batcher writes. */
  private encodeKey(key: string): Uint8Array {
    return Uint8Array.from(Buffer.from(key, "utf-8"));
  }

  /**
   * Resolve the live flow contract address from the first selected node's
   * status, falling back to the configured/default address if unavailable.
   */
  private async resolveFlowContract(
    nodes: InstanceType<typeof import("@0gfoundation/0g-storage-ts-sdk").StorageNode>[]
  ): Promise<ReturnType<typeof getFlowContract>> {
    try {
      const status = await nodes[0].getStatus();
      const addr = status?.networkIdentity?.flowAddress ?? this.fallbackFlowAddr;
      return getFlowContract(addr, this.signer);
    } catch {
      return getFlowContract(this.fallbackFlowAddr, this.signer);
    }
  }


  // ---------------------------------------------------------------------------
  // Key-Value Operations
  // ---------------------------------------------------------------------------

  async put(namespace: string, key: string, value: string): Promise<string> {
    const fullKey = `${namespace}/${key}`;
    try {
      const streamId = this.streamId(namespace);

      // Wrap the entire on-chain write in a 30-second timeout.
      const writeTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("put timeout after 30s")), 30_000)
      );

      const txHash = await Promise.race([
        (async () => {
          const [nodes, nodesErr] = await this.indexer.selectNodes(1);
          if (nodesErr || !nodes?.length) {
            throw new Error(`selectNodes failed: ${nodesErr}`);
          }

          const flow    = await this.resolveFlowContract(nodes);
          const batcher = new Batcher(1, nodes, flow, this.evmRpc);
          batcher.streamDataBuilder.set(
            streamId,
            this.encodeKey(key),
            Uint8Array.from(Buffer.from(value, "utf-8"))
          );

          // Suppress noisy SDK console output during the upload attempt.
          const _log = console.log;
          console.log = () => {};
          try {
            const [tx, err] = await batcher.exec();
            if (err) throw err;
            return tx.txHash as string;
          } finally {
            console.log = _log;
          }
        })(),
        writeTimeout,
      ]);

      console.log(`[0G Storage] put ${fullKey} → tx ${txHash}`);
      // Mirror locally so subsequent reads don't wait for indexing.
      this.kvFallback.set(fullKey, { value, timestamp: Date.now() });
      return txHash;
    } catch (sdkErr) {
      // On-chain write unavailable — log the real reason then fall back to in-memory.
      const msg = (sdkErr as Error)?.message ?? String(sdkErr);
      const short = msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
      console.warn(`[0G Storage] put ${fullKey} → on-chain failed (${short}); using in-memory fallback`);
      this.kvFallback.set(fullKey, { value, timestamp: Date.now() });
      return `0xfallback_${Date.now().toString(16)}`;
    }
  }

  async get(namespace: string, key: string): Promise<string | null> {
    const fullKey = `${namespace}/${key}`;
    try {
      // KvClient.getValue expects Bytes (ArrayLike<number>); Uint8Array satisfies this.
      // Wrap in a 5-second timeout so a slow/unreachable KV node doesn't block the pipeline.
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("KV node timeout")), 5000)
      );
      const result = await Promise.race([
        this.kvClient.getValue(this.streamId(namespace), this.encodeKey(key)),
        timeoutPromise,
      ]);
      if (!result) {
        // Not indexed yet — return from local mirror if available.
        return this.kvFallback.get(fullKey)?.value ?? null;
      }
      // The KV node returns { data: string } where data is a base64-encoded payload.
      const rawData = (result as unknown as { data: string }).data;
      const decoded = Buffer.from(rawData, "base64").toString("utf-8");
      this.kvFallback.set(fullKey, { value: decoded, timestamp: Date.now() });
      return decoded;
    } catch (sdkErr) {
      // KV node unreachable or timeout — serve from in-memory mirror.
      return this.kvFallback.get(fullKey)?.value ?? null;
    }
  }

  async list(namespace: string, prefix?: string): Promise<StorageRecord[]> {
    // Use in-memory mirror for listing — every put() mirrors there.
    const nsPrefix = `${namespace}/`;
    const records: StorageRecord[] = [];
    for (const [fullKey, entry] of this.kvFallback) {
      if (!fullKey.startsWith(nsPrefix)) continue;
      const key = fullKey.slice(nsPrefix.length);
      if (prefix && !key.startsWith(prefix)) continue;
      records.push({ key, value: entry.value, namespace });
    }
    return records;
  }

  // ---------------------------------------------------------------------------
  // Log Operations (append-only list stored as a JSON array under one key)
  // ---------------------------------------------------------------------------

  async appendLog(logName: string, data: string): Promise<string> {
    const existing = await this.get("logs", logName);
    const arr: string[] = existing ? (JSON.parse(existing) as string[]) : [];
    arr.push(data);
    return this.put("logs", logName, JSON.stringify(arr));
  }

  async readLog(logName: string, fromIndex = 0): Promise<string[]> {
    const raw = await this.get("logs", logName);
    if (!raw) return [];
    try {
      return (JSON.parse(raw) as string[]).slice(fromIndex);
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Typed JSON helpers
  // ---------------------------------------------------------------------------

  async storeJSON<T>(namespace: string, key: string, data: T): Promise<string> {
    return this.put(namespace, key, JSON.stringify(data));
  }

  async getJSON<T>(namespace: string, key: string): Promise<T | null> {
    const raw = await this.get(namespace, key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}

export default ZGStorage;
