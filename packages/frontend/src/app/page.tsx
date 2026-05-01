'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import WorkerCard from '@/components/WorkerCard'
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

interface StatsResponse {
  totalWorkers?: number
  totalTasks?: number
  avgReputation?: number
  totalFees?: string
}

type SortKey = 'score' | 'fee' | 'jobs'
type FilterType = 'all' | TaskType

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function SkeletonCard() {
  return (
    <div className="bg-[#111111] border border-[#222222] rounded-xl p-5 animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="flex gap-2 items-center">
          <div className="w-2 h-2 rounded-full bg-[#222222]" />
          <div className="w-16 h-3 bg-[#222222] rounded" />
        </div>
        <div className="w-28 h-3 bg-[#222222] rounded" />
      </div>
      <div className="w-24 h-8 bg-[#222222] rounded mb-3" />
      <div className="w-full h-1.5 bg-[#222222] rounded-full mb-4" />
      <div className="flex gap-2 mb-4">
        <div className="w-20 h-5 bg-[#222222] rounded-full" />
        <div className="w-24 h-5 bg-[#222222] rounded-full" />
      </div>
      <div className="flex justify-between">
        <div className="w-20 h-3 bg-[#222222] rounded" />
        <div className="w-14 h-3 bg-[#222222] rounded" />
        <div className="w-12 h-3 bg-[#222222] rounded" />
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortKey>('score')

  const { data: workersData, isLoading: workersLoading } = useSWR<WorkerListItem[]>(
    '/api/workers',
    fetcher,
    { refreshInterval: 10000 }
  )
  const { data: stats } = useSWR<StatsResponse>('/api/stats', fetcher, {
    refreshInterval: 10000,
  })

  const workers = Array.isArray(workersData) ? workersData : []

  const filtered = workers
    .filter((w) => filter === 'all' || w.capabilities.includes(filter as TaskType))
    .sort((a, b) => {
      if (sort === 'score') return b.score.composite - a.score.composite
      if (sort === 'fee') return parseFloat(a.feePerTask) - parseFloat(b.feePerTask)
      if (sort === 'jobs') return b.score.totalJobs - a.score.totalJobs
      return 0
    })

  const filterOptions: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pool-indexer', label: 'pool-indexer' },
    { key: 'wallet-summarizer', label: 'wallet-summarizer' },
    { key: 'token-fact-checker', label: 'token-fact-checker' },
  ]

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'score', label: 'By Score' },
    { key: 'fee', label: 'By Fee' },
    { key: 'jobs', label: 'By Jobs' },
  ]

  const avgRepPct =
    stats?.avgReputation != null
      ? ((stats.avgReputation / 10000) * 100).toFixed(1) + '%'
      : '—'

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-white tracking-tight">⬡ AgentNet</span>
            <span className="text-sm text-gray-500">Explorer</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs text-green-400">Live</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Workers', value: stats?.totalWorkers?.toString() ?? '—' },
            { label: 'Total Tasks', value: stats?.totalTasks?.toLocaleString() ?? '—' },
            { label: 'Avg Reputation', value: avgRepPct },
            { label: 'Total Fees', value: stats?.totalFees ? `${stats.totalFees} OG` : '—' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[#111111] border border-[#222222] rounded-xl px-4 py-3"
            >
              <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
              <p className="text-lg font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Main layout: grid + sidebar */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: filters + worker grid */}
          <div className="flex-1 min-w-0">
            {/* Filters + Sort */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex gap-1 flex-wrap">
                {filterOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setFilter(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filter === opt.key
                        ? 'bg-white text-black'
                        : 'bg-[#111111] border border-[#222222] text-gray-400 hover:text-gray-200 hover:border-[#333333]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="sm:ml-auto">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="bg-[#111111] border border-[#222222] text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#444444] cursor-pointer"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Worker grid */}
            {workersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <p className="text-lg mb-1">No workers registered yet</p>
                <p className="text-sm">Start the orchestrator to see agents appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((worker) => (
                  <WorkerCard
                    key={worker.address}
                    worker={worker}
                    onClick={() => router.push(`/workers/${worker.address}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Activity sidebar (desktop only) */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <ActivityFeed maxItems={30} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-gray-700">
          Contracts on 0G Galileo Testnet · Chain ID 16602
        </div>
      </div>
    </div>
  )
}
