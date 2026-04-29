import type { StorageRecord } from "@agentnet/types";
import { getConfig } from "@agentnet/config";

// TODO(0g-sdk): When integrating the real 0G Storage SDK, uncomment and wire:
//   import { Indexer, KvClient, Batcher, getFlowContract } from "@0glabs/0g-ts-sdk";
//   import { ethers } from "ethers";
// KvClient(rpcUrl) provides getValue(streamId, key, version?) and newIterator().
// Batcher(version, storageNodes, flowContract, provider) handles writes via set()/exec().
// Indexer(rpcUrl) provides upload(zgFile, opts) / download(root, filePath, opts).
// Each namespace maps to a streamId (bytes32); derive with ethers.id(namespace).

type StorageEntry = { value: string; timestamp: number };

export class ZGStorage {
  private readonly endpoint: string;
  private readonly privateKey: string;

  // In-memory fallback store used in dev/test until real SDK is wired.
  private kvStore = new Map<string, StorageEntry>();
  private logStore = new Map<string, string[]>();

  constructor(endpoint?: string, privateKey?: string) {
    if (endpoint && privateKey) {
      this.endpoint = endpoint;
      this.privateKey = privateKey;
    } else {
      const cfg = getConfig();
      this.endpoint = cfg.zgStorageEndpoint;
      this.privateKey = cfg.privateKey;
    }

    // TODO(0g-sdk): Initialize KvClient and Indexer here:
    //   this.kvClient = new KvClient(this.endpoint);
    //   this.indexer = new Indexer(this.endpoint);
    //   const provider = new ethers.JsonRpcProvider(cfg.zgRpcUrl);
    //   const signer = new ethers.Wallet(this.privateKey, provider);
    //   this.flow = getFlowContract(contractAddress, signer);
    void this.endpoint;
    void this.privateKey;
  }

  // ---------------------------------------------------------------------------
  // Key-Value Operations
  // ---------------------------------------------------------------------------

  async put(namespace: string, key: string, value: string): Promise<string> {
    const fullKey = `${namespace}/${key}`;

    // TODO(0g-sdk): Replace in-memory write with Batcher call:
    //   const streamId = ethers.id(namespace);
    //   const batcher = await this.indexer.newUploaderFromIndexerNodes(...);
    //   const builder = new StreamDataBuilder(version);
    //   builder.set(streamId, encodeKey(key), Buffer.from(value));
    //   const [tx] = await batcher.exec();
    //   return tx.hash;

    this.kvStore.set(fullKey, { value, timestamp: Date.now() });
    return `0xdev_${Buffer.from(fullKey).toString("hex").slice(0, 40)}`;
  }

  async get(namespace: string, key: string): Promise<string | null> {
    const fullKey = `${namespace}/${key}`;

    // TODO(0g-sdk): Replace with KvClient read:
    //   const streamId = ethers.id(namespace);
    //   const result = await this.kvClient.getValue(streamId, encodeKey(key));
    //   if (!result) return null;
    //   return Buffer.from(result.data).toString("utf8");

    return this.kvStore.get(fullKey)?.value ?? null;
  }

  async list(namespace: string, prefix?: string): Promise<StorageRecord[]> {
    // TODO(0g-sdk): Replace with KvIterator scan:
    //   const streamId = ethers.id(namespace);
    //   const iter = this.kvClient.newIterator(streamId);
    //   const records: StorageRecord[] = [];
    //   for await (const entry of iter) {
    //     const key = decodeKey(entry.key);
    //     if (!prefix || key.startsWith(prefix)) {
    //       records.push({ key, value: Buffer.from(entry.data).toString("utf8"), namespace });
    //     }
    //   }
    //   return records;

    const nsPrefix = `${namespace}/`;
    const records: StorageRecord[] = [];
    for (const [fullKey, entry] of this.kvStore) {
      if (!fullKey.startsWith(nsPrefix)) continue;
      const key = fullKey.slice(nsPrefix.length);
      if (prefix && !key.startsWith(prefix)) continue;
      records.push({ key, value: entry.value, namespace });
    }
    return records;
  }

  // ---------------------------------------------------------------------------
  // Log Operations
  // ---------------------------------------------------------------------------

  async appendLog(logName: string, data: string): Promise<string> {
    // TODO(0g-sdk): Store log entries as indexed KV entries in a dedicated stream:
    //   const streamId = ethers.id(`log:${logName}`);
    //   const index = await this.getLogLength(streamId);
    //   ... batcher.set(streamId, encodeIndex(index), Buffer.from(data)) ...

    const log = this.logStore.get(logName) ?? [];
    log.push(data);
    this.logStore.set(logName, log);
    const idx = log.length - 1;
    return `0xdev_log_${Buffer.from(logName).toString("hex").slice(0, 32)}_${idx}`;
  }

  async readLog(logName: string, fromIndex = 0): Promise<string[]> {
    // TODO(0g-sdk): Iterate KV stream entries from fromIndex:
    //   const streamId = ethers.id(`log:${logName}`);
    //   const iter = this.kvClient.newIterator(streamId, version);
    //   // seek to fromIndex, collect remaining entries

    return (this.logStore.get(logName) ?? []).slice(fromIndex);
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  async storeJSON<T>(namespace: string, key: string, data: T): Promise<string> {
    return this.put(namespace, key, JSON.stringify(data));
  }

  async getJSON<T>(namespace: string, key: string): Promise<T | null> {
    const raw = await this.get(namespace, key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}

export default ZGStorage;
