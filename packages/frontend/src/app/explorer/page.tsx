'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import WorkerCard from '@/components/WorkerCard'
import ActivityFeed from '@/components/ActivityFeed'
import TaskPanel from '@/components/TaskPanel'
import RegisterWorkerModal from '@/components/RegisterWorkerModal'
import MyTasksTab from '@/components/MyTasksTab'
import { useWallet } from '@/hooks/useWallet'

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

type SortKey = 'score' | 'fee' | 'jobs'
type FilterType = 'all' | TaskType
type Tab = 'workers' | 'my-tasks'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function SkeletonCard() {
  return (
    <div
      className="p-5 border animate-pulse"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--r-lg)',
      }}
    >
      <div className="flex justify-between mb-4">
        <div className="flex gap-2 items-center">
          <div className="w-11 h-11 rounded-full" style={{ background: 'var(--border-strong)' }} />
          <div className="space-y-1.5">
            <div className="w-16 h-2.5 rounded" style={{ background: 'var(--border-strong)' }} />
            <div className="w-24 h-2 rounded" style={{ background: 'var(--border)' }} />
          </div>
        </div>
        <div className="w-14 h-5 rounded" style={{ background: 'var(--border)' }} />
      </div>
      <div className="w-20 h-7 rounded mb-3" style={{ background: 'var(--border-strong)' }} />
      <div className="flex gap-2 mb-4">
        <div className="w-20 h-5 rounded-full" style={{ background: 'var(--border)' }} />
        <div className="w-24 h-5 rounded-full" style={{ background: 'var(--border)' }} />
      </div>
      <div className="flex justify-between">
        <div className="w-20 h-2.5 rounded" style={{ background: 'var(--border)' }} />
        <div className="w-14 h-2.5 rounded" style={{ background: 'var(--border)' }} />
        <div className="w-12 h-2.5 rounded" style={{ background: 'var(--border)' }} />
      </div>
    </div>
  )
}

export default function ExplorerPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortKey>('score')
  const [tab, setTab] = useState<Tab>('workers')
  const [taskPanelOpen, setTaskPanelOpen] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [latestTask, setLatestTask] = useState<TaskRecord | null>(null)

  const { address, balance, isConnected, isConnecting, connect, disconnect, writeContract, waitForTx } = useWallet()

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

  const handleTaskComplete = (task: TaskRecord) => {
    setLatestTask(task)
    setTab('my-tasks')
  }

  const openTaskPanel = () => {
    if (!isConnected) connect()
    else setTaskPanelOpen(true)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Header ──────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 border-b backdrop-blur-sm"
        style={{
          background: 'rgba(7,8,11,0.92)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          {/* Wordmark + back */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="font-display text-xl tracking-[-0.01em]"
              style={{ color: 'var(--text)' }}
            >
              Agent<em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Net</em>
            </Link>
            <span className="hidden sm:block font-mono text-xs" style={{ color: 'var(--text-subtle)' }}>
              Explorer
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Live badge */}
            <span
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] border"
              style={{
                color: 'var(--accent)',
                borderColor: 'rgba(45,201,100,0.25)',
                borderRadius: 2,
                background: 'rgba(45,201,100,0.06)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--accent)' }} />
              Live
            </span>

            {/* Submit Task */}
            <button
              onClick={openTaskPanel}
              className="font-sans font-semibold text-xs transition-all duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{
                background: 'var(--accent)',
                color: '#07080B',
                borderRadius: 'var(--r-pill)',
                padding: '7px 16px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              + Submit Job
            </button>

            {/* Wallet */}
            {isConnected ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRegisterOpen(true)}
                  className="hidden sm:flex items-center gap-1.5 font-sans text-xs transition-all duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                  style={{
                    padding: '7px 14px',
                    borderRadius: 'var(--r-pill)',
                    border: '1px solid rgba(129,105,216,0.3)',
                    background: 'rgba(129,105,216,0.08)',
                    color: 'var(--accent-2)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(129,105,216,0.16)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(129,105,216,0.08)')}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-2)' }} />
                  Become a Worker
                </button>

                <div
                  className="flex items-center gap-1.5 border"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: 'var(--r-pill)',
                    padding: '6px 12px',
                  }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />
                  <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    {address!.slice(0, 6)}…{address!.slice(-4)}
                  </span>
                  {balance && (
                    <span className="font-mono text-[10px] hidden sm:block" style={{ color: 'var(--text-subtle)' }}>
                      · {balance} OG
                    </span>
                  )}
                  <button
                    onClick={disconnect}
                    className="font-mono text-[10px] ml-1 transition-colors"
                    style={{ color: 'var(--text-subtle)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#F26B61')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
                    title="Disconnect"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="font-sans text-xs border transition-all duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] disabled:opacity-50"
                style={{
                  color: 'var(--text-muted)',
                  borderColor: 'var(--border-strong)',
                  borderRadius: 'var(--r-pill)',
                  padding: '7px 16px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text)'
                  e.currentTarget.style.borderColor = 'var(--text-subtle)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)'
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
                }}
              >
                {isConnecting ? 'Connecting…' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-6">

        {/* ── KPI Tiles ─────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { eyebrow: 'Active Workers', value: stats?.totalWorkers?.toString() ?? '—', unit: null },
            { eyebrow: 'Jobs Done', value: stats?.totalTasks?.toLocaleString() ?? '—', unit: null },
            { eyebrow: 'Avg Reputation', value: avgRepPct, unit: null },
            { eyebrow: 'Fees Settled', value: stats?.totalFees ?? '—', unit: 'OG' },
          ].map((kpi) => (
            <div
              key={kpi.eyebrow}
              className="p-5 border"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                borderRadius: 'var(--r-lg)',
              }}
            >
              <div className="eyebrow mb-3">{kpi.eyebrow}</div>
              <div
                className="font-display leading-none"
                style={{ fontSize: 40, color: 'var(--text)' }}
              >
                {kpi.value}
                {kpi.unit && (
                  <span className="font-mono text-sm ml-1.5" style={{ color: 'var(--text-subtle)' }}>
                    {kpi.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Mobile: Become a Worker banner ────────────── */}
        {isConnected && (
          <div className="sm:hidden mb-5">
            <button
              onClick={() => setRegisterOpen(true)}
              className="w-full flex items-center justify-between border font-sans text-xs"
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--r-lg)',
                border: '1px solid rgba(129,105,216,0.3)',
                background: 'rgba(129,105,216,0.08)',
                color: 'var(--accent-2)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-2)' }} />
                <span className="font-medium">Become a Worker</span>
              </div>
              <span>→</span>
            </button>
          </div>
        )}

        {/* ── Tabs ──────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-5">
          {([{ key: 'workers', label: 'All Workers' }, { key: 'my-tasks', label: 'My Jobs' }] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="font-sans font-medium text-xs transition-all duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--r-pill)',
                background: tab === key ? 'var(--text)' : 'transparent',
                color: tab === key ? 'var(--bg)' : 'var(--text-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Main layout ───────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: tab content */}
          <div className="flex-1 min-w-0">
            {tab === 'workers' && (
              <>
                {/* Filter + sort bar */}
                <div className="flex flex-col sm:flex-row gap-3 mb-5">
                  <div className="flex gap-1.5 flex-wrap">
                    {filterOptions.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setFilter(opt.key)}
                        className="font-mono text-[11px] transition-all duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--r-pill)',
                          border: filter === opt.key
                            ? '1px solid var(--accent)'
                            : '1px solid var(--border)',
                          background: filter === opt.key
                            ? 'rgba(45,201,100,0.1)'
                            : 'var(--surface)',
                          color: filter === opt.key
                            ? 'var(--accent)'
                            : 'var(--text-muted)',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="sm:ml-auto">
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortKey)}
                      className="font-mono text-xs focus:outline-none cursor-pointer"
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                        borderRadius: 'var(--r-md)',
                        padding: '7px 12px',
                      }}
                    >
                      {sortOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Worker grid */}
                {workersLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <SkeletonCard /><SkeletonCard /><SkeletonCard />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24" style={{ color: 'var(--text-subtle)' }}>
                    <p className="font-sans text-base mb-1">No workers registered yet.</p>
                    <p className="font-sans text-sm">Start the seed script to populate the network.</p>
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
              </>
            )}

            {tab === 'my-tasks' && (
              <MyTasksTab
                address={address}
                onSubmitTask={openTaskPanel}
                latestTask={latestTask}
              />
            )}
          </div>

          {/* Right: Activity sidebar */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <ActivityFeed maxItems={30} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center font-mono text-xs" style={{ color: 'var(--text-subtle)' }}>
          Contracts on 0G Galileo Testnet · Chain ID 16602
        </div>
      </div>

      {/* Task Panel */}
      <TaskPanel
        open={taskPanelOpen}
        onClose={() => setTaskPanelOpen(false)}
        walletAddress={address}
        onTaskComplete={(task) => {
          handleTaskComplete(task)
          setTaskPanelOpen(false)
        }}
      />

      {/* Register Worker Modal */}
      {registerOpen && address && (
        <RegisterWorkerModal
          open={registerOpen}
          onClose={() => setRegisterOpen(false)}
          address={address}
          writeContract={writeContract}
          waitForTx={waitForTx}
        />
      )}
    </div>
  )
}
