'use client'

import { useEffect, useState } from 'react'

type TaskType = 'pool-indexer' | 'wallet-summarizer' | 'token-fact-checker'

interface TaskRecord {
  taskId: string
  taskType: TaskType
  params: Record<string, string>
  workerAddress: string
  workerScore: number
  workerFee: string
  result: unknown
  executionMs: number
  completedAt: number
  callerAddress: string | null
}

interface MyTasksTabProps {
  address: string | null
  onSubmitTask: () => void
  // Injected from parent when a new task completes
  latestTask?: TaskRecord | null
}

const typeColor: Record<TaskType, string> = {
  'pool-indexer': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  'wallet-summarizer': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  'token-fact-checker': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
}

const typeLabel: Record<TaskType, string> = {
  'pool-indexer': 'Pool Indexer',
  'wallet-summarizer': 'Wallet Summary',
  'token-fact-checker': 'Token Check',
}

function fmt(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(ts).toLocaleDateString()
}

function resultSummary(taskType: TaskType, result: unknown): string {
  if (!result) return '—'
  const r = result as Record<string, unknown>
  if (taskType === 'pool-indexer') {
    const t0 = (r.token0 as { symbol: string })?.symbol ?? '?'
    const t1 = (r.token1 as { symbol: string })?.symbol ?? '?'
    return `${t0}/${t1} · ${r.swapCount} swaps`
  }
  if (taskType === 'wallet-summarizer') {
    const stats = r.stats as Record<string, unknown> | undefined
    return `${stats?.txCount ?? '?'} txs · ${stats?.mostActiveProtocol ?? '?'}`
  }
  if (taskType === 'token-fact-checker') {
    return `Verdict: ${r.verdict ?? '?'} (${r.confidence ?? '?'}% confidence)`
  }
  return 'Done'
}

function verdictChip(taskType: TaskType, result: unknown) {
  if (taskType !== 'token-fact-checker' || !result) return null
  const verdict = (result as Record<string, unknown>).verdict as string
  const map: Record<string, string> = {
    legit: 'text-green-400 bg-green-500/10 border-green-500/30',
    suspicious: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    honeypot: 'text-red-400 bg-red-500/10 border-red-500/30',
    rug: 'text-red-400 bg-red-500/10 border-red-500/30',
    unknown: 'text-gray-400 bg-[#222] border-[#333]',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${map[verdict] ?? map.unknown}`}>
      {verdict}
    </span>
  )
}

export default function MyTasksTab({ address, onSubmitTask, latestTask }: MyTasksTabProps) {
  const [tasks, setTasks] = useState<TaskRecord[]>([])

  const storageKey = address ? `agentnet_tasks_${address.toLowerCase()}` : null

  // Load from localStorage on mount / address change
  useEffect(() => {
    if (!storageKey) { setTasks([]); return }
    try {
      const raw = localStorage.getItem(storageKey)
      setTasks(raw ? JSON.parse(raw) : [])
    } catch {
      setTasks([])
    }
  }, [storageKey])

  // Prepend new task when it arrives
  useEffect(() => {
    if (!latestTask || !storageKey) return
    setTasks((prev) => {
      const already = prev.find((t) => t.taskId === latestTask.taskId)
      if (already) return prev
      const updated = [latestTask, ...prev]
      try { localStorage.setItem(storageKey, JSON.stringify(updated)) } catch {}
      return updated
    })
  }, [latestTask, storageKey])

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
        <div className="text-4xl">⬡</div>
        <p className="text-sm font-medium text-gray-400">Connect your wallet to see your tasks</p>
        <p className="text-xs text-gray-600">Task history is stored per wallet address.</p>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
        <div className="text-4xl">◎</div>
        <p className="text-sm font-medium text-gray-400">No tasks yet</p>
        <p className="text-xs text-gray-600">Submit your first task to see it here.</p>
        <button
          onClick={onSubmitTask}
          className="mt-2 px-4 py-2 bg-white text-black text-xs font-semibold rounded-lg hover:bg-gray-100 transition-colors"
        >
          Submit a Task →
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''} completed</p>
        <button
          onClick={onSubmitTask}
          className="px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-lg hover:bg-gray-100 transition-colors"
        >
          + New Task
        </button>
      </div>

      {tasks.map((task) => (
        <div
          key={task.taskId}
          className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4 space-y-2 hover:border-[#2a2a2a] transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeColor[task.taskType]}`}>
                {typeLabel[task.taskType]}
              </span>
              {verdictChip(task.taskType, task.result)}
            </div>
            <span className="text-[10px] text-gray-600 flex-shrink-0">{timeAgo(task.completedAt)}</span>
          </div>

          <p className="text-xs text-gray-300">{resultSummary(task.taskType, task.result)}</p>

          <div className="flex items-center justify-between pt-1 border-t border-[#1a1a1a]">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-600">Worker</span>
              <span className="text-[10px] font-mono text-gray-400">{fmt(task.workerAddress)}</span>
              <span className="text-[10px] text-yellow-500">⭐ {task.workerScore.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-gray-600">{task.executionMs}ms</span>
          </div>
        </div>
      ))}
    </div>
  )
}
