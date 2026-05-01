'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import ScoreTimeline from '@/components/ScoreTimeline'
import ActivityFeed from '@/components/ActivityFeed'

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

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

const statusDotColors: Record<AgentStatus, string> = {
  idle: 'bg-green-400',
  working: 'bg-green-400',
  error: 'bg-red-400',
  offline: 'bg-gray-500',
}

const capabilityStyles: Record<TaskType, string> = {
  'pool-indexer': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  'wallet-summarizer': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  'token-fact-checker': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface WorkerDetailPageProps {
  params: { address: string }
}

export default function WorkerDetailPage({ params }: WorkerDetailPageProps) {
  const { address } = params
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const { data: workersData, isLoading } = useSWR<WorkerListItem[]>('/api/workers', fetcher, {
    refreshInterval: 10000,
  })

  const workers = Array.isArray(workersData) ? workersData : []
  const worker = workers.find((w) => w.address.toLowerCase() === address.toLowerCase())

  const handleCopy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading worker data...</div>
      </div>
    )
  }

  if (!worker) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors mb-6 flex items-center gap-1"
          >
            ← All Workers
          </button>
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <p className="text-lg mb-1">Worker not found</p>
            <p className="text-sm font-mono">{address}</p>
          </div>
        </div>
      </div>
    )
  }

  const { score } = worker

  const gauges = [
    {
      label: 'Accuracy',
      value: score.accuracy,
      description: 'Task result correctness',
      size: 'normal',
    },
    {
      label: 'Timeliness',
      value: score.timeliness,
      description: 'Delivery within deadline',
      size: 'normal',
    },
    {
      label: 'Uptime',
      value: score.uptime,
      description: 'Availability over time',
      size: 'normal',
    },
    {
      label: 'Composite',
      value: score.composite,
      description: 'acc 50% · tim 30% · upt 20%',
      size: 'large',
    },
  ] as const

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
          >
            ← All Workers
          </button>
          <span className="text-gray-700">|</span>
          <span className="text-sm text-gray-500">Worker Detail</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Worker header card */}
        <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDotColors[worker.status]}`} />
                <span className="text-xs text-gray-500 capitalize">{worker.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base text-gray-200 break-all">{address}</span>
                <button
                  onClick={handleCopy}
                  className="text-gray-500 hover:text-gray-300 transition-colors text-sm flex-shrink-0"
                  title="Copy address"
                >
                  {copied ? '✓' : '⧉'}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {worker.capabilities.map((cap) => (
                <span
                  key={cap}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${capabilityStyles[cap]}`}
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Score gauges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {gauges.map((gauge) => (
            <div
              key={gauge.label}
              className={`bg-[#111111] border border-[#222222] rounded-xl p-4 ${
                gauge.size === 'large' ? 'md:col-span-1 ring-1 ring-yellow-400/20' : ''
              }`}
            >
              <p className="text-xs text-gray-500 mb-1">{gauge.label}</p>
              <p
                className={`font-bold ${scoreColor(gauge.value)} ${
                  gauge.size === 'large' ? 'text-3xl' : 'text-2xl'
                }`}
              >
                {gauge.value.toLocaleString()}
              </p>
              <p className="text-xs text-gray-600 mt-1">{gauge.description}</p>
            </div>
          ))}
        </div>

        {/* Score Timeline */}
        <ScoreTimeline address={address} />

        {/* Worker info table */}
        <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Worker Info</h3>
          <div className="space-y-3">
            {[
              { label: 'Fee Per Task', value: `${worker.feePerTask} OG` },
              { label: 'Total Jobs', value: score.totalJobs.toLocaleString() },
              {
                label: 'Capabilities',
                value: worker.capabilities.join(', '),
              },
              { label: 'Last Updated', value: timeAgo(score.lastUpdated) },
              { label: 'Address', value: address, mono: true },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4 text-sm py-2 border-b border-[#1a1a1a] last:border-b-0">
                <span className="text-gray-500">{row.label}</span>
                <span className={`text-gray-300 text-right break-all ${row.mono ? 'font-mono text-xs' : ''}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity for this worker */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Activity</h3>
          <ActivityFeedForAddress address={address} />
        </div>
      </div>
    </div>
  )
}

// Filtered activity feed for this specific worker address
function ActivityFeedForAddress({ address }: { address: string }) {
  interface ActivityEvent {
    id: string
    type: 'task' | 'payment' | 'score'
    summary: string
    actors: string[]
    timestamp: number
    txHash?: string
  }

  const { data, isLoading } = useSWR<ActivityEvent[]>('/api/activity', fetcher, {
    refreshInterval: 5000,
  })

  const events = Array.isArray(data) ? data : []
  const filtered = events.filter((e) =>
    e.actors.some((a) => a.toLowerCase() === address.toLowerCase())
  )

  function timeAgoLocal(ts: number) {
    const s = Math.floor((Date.now() - ts) / 1000)
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
  }

  const eventIcons: Record<ActivityEvent['type'], string> = {
    task: '⚙️',
    payment: '💰',
    score: '⭐',
  }

  if (isLoading) {
    return (
      <div className="bg-[#111111] border border-[#222222] rounded-xl p-4 animate-pulse space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-6 h-6 bg-[#222222] rounded" />
            <div className="flex-1">
              <div className="h-3 bg-[#222222] rounded w-3/4 mb-2" />
              <div className="h-2.5 bg-[#222222] rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="bg-[#111111] border border-[#222222] rounded-xl p-6 text-center text-gray-500 text-sm">
        No activity yet for this worker.
      </div>
    )
  }

  return (
    <div className="bg-[#111111] border border-[#222222] rounded-xl overflow-hidden">
      <div className="max-h-72 overflow-y-auto divide-y divide-[#1a1a1a]">
        {filtered.map((event) => (
          <div key={event.id} className="py-3 px-4 hover:bg-[#0f0f0f] transition-colors">
            <div className="flex items-start gap-3">
              <span className="text-base flex-shrink-0 mt-0.5">{eventIcons[event.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300">{event.summary}</p>
                {event.txHash && (
                  <a
                    href={`https://chainscan-galileo.0g.ai/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-gray-500 hover:text-gray-300 transition-colors mt-0.5 inline-block"
                  >
                    {event.txHash.slice(0, 10)}... ↗
                  </a>
                )}
              </div>
              <span className="text-xs text-gray-600 flex-shrink-0 mt-0.5">
                {timeAgoLocal(event.timestamp)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
