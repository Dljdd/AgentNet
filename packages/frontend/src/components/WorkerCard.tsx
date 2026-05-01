'use client'

import { useState } from 'react'

type AgentStatus = 'idle' | 'working' | 'error' | 'offline'
type TaskType = 'pool-indexer' | 'wallet-summarizer' | 'token-fact-checker'

interface ReputationScore {
  accuracy: number
  timeliness: number
  uptime: number
  composite: number
  totalJobs: number
  lastUpdated: number
}

interface WorkerListItem {
  address: string
  status: AgentStatus
  score: ReputationScore
  capabilities: TaskType[]
  feePerTask: string
}

function scoreColor(score: number) {
  if (score >= 7500) return 'text-green-400'
  if (score >= 5000) return 'text-yellow-400'
  return 'text-red-400'
}

function scoreBg(score: number) {
  if (score >= 7500) return 'bg-green-400'
  if (score >= 5000) return 'bg-yellow-400'
  return 'bg-red-400'
}

function formatAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

const capabilityStyles: Record<TaskType, string> = {
  'pool-indexer': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  'wallet-summarizer': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  'token-fact-checker': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
}

const statusColors: Record<AgentStatus, string> = {
  idle: 'bg-green-400',
  working: 'bg-green-400',
  error: 'bg-gray-500',
  offline: 'bg-gray-500',
}

interface WorkerCardProps {
  worker: WorkerListItem
  onClick?: () => void
}

export default function WorkerCard({ worker, onClick }: WorkerCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(worker.address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
    })
  }

  const barWidth = Math.min(100, (worker.score.composite / 10000) * 100)

  return (
    <div
      onClick={onClick}
      className="bg-[#111111] border border-[#222222] rounded-xl p-5 cursor-pointer hover:border-[#444444] transition-all hover:scale-[1.01]"
    >
      {/* Status + Address row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColors[worker.status]}`} />
          <span className="text-xs text-gray-400 capitalize">{worker.status}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-gray-300">{formatAddr(worker.address)}</span>
          <button
            onClick={handleCopy}
            className="text-gray-500 hover:text-gray-300 transition-colors text-xs w-5 h-5 flex items-center justify-center"
            title="Copy address"
          >
            {copied ? '✓' : '⧉'}
          </button>
        </div>
      </div>

      {/* Composite Score */}
      <div className="mb-3">
        <div className="flex items-baseline gap-1 mb-2">
          <span className={`text-3xl font-bold ${scoreColor(worker.score.composite)}`}>
            {worker.score.composite.toLocaleString()}
          </span>
          <span className="text-sm text-gray-600">/ 10000</span>
        </div>
        {/* Score bar */}
        <div className="w-full bg-[#222222] rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${scoreBg(worker.score.composite)}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {worker.capabilities.map((cap) => (
          <span
            key={cap}
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${capabilityStyles[cap]}`}
          >
            {cap}
          </span>
        ))}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{worker.feePerTask} OG / task</span>
        <span>{worker.score.totalJobs} jobs</span>
        <span>{timeAgo(worker.score.lastUpdated)}</span>
      </div>
    </div>
  )
}
