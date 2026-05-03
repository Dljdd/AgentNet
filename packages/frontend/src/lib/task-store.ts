// In-process task result store.
// Mirrors the 0G Storage namespace pattern (namespace/key) in memory so the
// frontend can surface task results without a full 0G SDK dependency.
// Data is ephemeral per server process — it resets on restart.

export interface StoredTask {
  taskId: string
  taskType: string
  workerAddress: string
  callerAddress: string | null
  result: unknown
  completedAt: number
  computeUsed: boolean
}

// Module-level singleton shared across all API route invocations in this process.
const store = new Map<string, StoredTask>()

export function saveTask(namespace: string, key: string, entry: StoredTask): void {
  store.set(`${namespace}/${key}`, entry)
}

export function getTask(namespace: string, key: string): StoredTask | null {
  return store.get(`${namespace}/${key}`) ?? null
}

export function listTasks(namespace: string, prefix?: string): StoredTask[] {
  const nsPrefix = `${namespace}/`
  const results: StoredTask[] = []
  for (const [fullKey, entry] of store) {
    if (!fullKey.startsWith(nsPrefix)) continue
    const key = fullKey.slice(nsPrefix.length)
    if (prefix && !key.startsWith(prefix)) continue
    results.push(entry)
  }
  return results.sort((a, b) => b.completedAt - a.completedAt)
}
