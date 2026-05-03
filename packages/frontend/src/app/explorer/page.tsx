'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import useSWR from 'swr'
import WorkerCard from '@/components/WorkerCard'
import ActivityFeed from '@/components/ActivityFeed'
import TaskPanel from '@/components/TaskPanel'
import RegisterWorkerModal from '@/components/RegisterWorkerModal'
import MyTasksTab from '@/components/MyTasksTab'
import { useWallet } from '@/hooks/useWallet'
import logoImg from '@/assets/logo.jpeg'

const PROFILE_IMAGES = [1,2,3,4,5,6,7,8,9].map((n) => require(`@/assets/Profileimg/${n}.png`))
function getProfileImage(address: string) {
  const idx = parseInt(address.slice(-4), 16) % PROFILE_IMAGES.length
  return PROFILE_IMAGES[idx]
}

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
        background: '#000000',
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 'var(--r-lg)',
      }}
    >
      <div className="flex justify-between mb-4">
        <div className="flex gap-2 items-center">
          <div className="w-11 h-11 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="space-y-1.5">
            <div className="w-16 h-2.5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="w-24 h-2 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
        </div>
        <div className="w-14 h-5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
      <div className="w-20 h-7 rounded mb-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="flex gap-2 mb-4">
        <div className="w-20 h-5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <div className="w-24 h-5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
      <div className="flex justify-between">
        <div className="w-20 h-2.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <div className="w-14 h-2.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <div className="w-12 h-2.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />
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
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false)
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const walletDropdownRef = useRef<HTMLDivElement>(null)
  const sortDropdownRef = useRef<HTMLDivElement>(null)

  const { address, balance, isConnected, isConnecting, connect, disconnect, writeContract, waitForTx } = useWallet()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(e.target as Node)) {
        setWalletDropdownOpen(false)
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setSortDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: workersData, isLoading: workersLoading } = useSWR<WorkerListItem[]>(
    '/api/workers', fetcher, { refreshInterval: 10000 }
  )
  const { data: stats } = useSWR<StatsResponse>('/api/stats', fetcher, { refreshInterval: 10000 })

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
  const selectedSortLabel = sortOptions.find((opt) => opt.key === sort)?.label ?? 'By Score'

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
    <div className="min-h-screen" style={{ background: '#000000', color: 'var(--text)' }}>

      {/* ── Navbar ──────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 border-b backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-3">

          {/* Logo + wordmark */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image src={logoImg} alt="AgentNet logo" width={28} height={28} className="rounded-md" />
              <span className="text-xl" style={{ fontFamily: 'var(--font-logo)' }}>
                Agent<span style={{ color: 'var(--accent)' }}>Net</span>
              </span>
            </Link>
            <span
              className="hidden sm:block font-mono text-xs px-2 py-0.5 rounded"
              style={{
                color: 'var(--text-subtle)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Explorer
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Submit Job */}
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
                  className="hidden sm:flex items-center gap-1.5 font-sans text-xs transition-all duration-[120ms]"
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

                {/* Profile avatar + dropdown */}
                <div ref={walletDropdownRef} className="relative">
                  <button
                    onClick={() => setWalletDropdownOpen((o) => !o)}
                    className="w-9 h-9 rounded-full overflow-hidden border-2 transition-all duration-[120ms]"
                    style={{
                      borderColor: walletDropdownOpen ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                    }}
                    title={address!}
                  >
                    <Image
                      src={getProfileImage(address!)}
                      alt="wallet avatar"
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                    />
                  </button>

                  {walletDropdownOpen && (
                    <div
                      className="absolute right-0 top-[calc(100%+8px)] w-64 border overflow-hidden z-50"
                      style={{
                        background: '#000000',
                        borderColor: 'rgba(255,255,255,0.12)',
                        borderRadius: 'var(--r-lg)',
                        boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(45,201,100,0.06) inset',
                      }}
                    >
                      {/* Account info */}
                      <div
                        className="px-4 py-3 border-b"
                        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                            <Image
                              src={getProfileImage(address!)}
                              alt="wallet avatar"
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-mono text-xs" style={{ color: 'var(--text)' }}>
                              {address!.slice(0, 6)}…{address!.slice(-4)}
                            </div>
                            {balance && (
                              <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--accent)' }}>
                                {balance} OG
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Menu items */}
                      <div className="p-1.5 space-y-0.5">
                        <button
                          onClick={() => {
                            setWalletDropdownOpen(false)
                            router.push(`/workers/${address}`)
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left font-sans text-sm transition-colors rounded-md"
                          style={{ color: 'var(--text-muted)', borderRadius: 8 }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                            e.currentTarget.style.color = 'var(--text)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'var(--text-muted)'
                          }}
                        >
                          <span style={{ fontSize: 15 }}>👤</span>
                          Account Details
                        </button>
                        <button
                          onClick={() => {
                            setWalletDropdownOpen(false)
                            disconnect()
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left font-sans text-sm transition-colors"
                          style={{ color: '#F26B61', borderRadius: 8 }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(242,107,97,0.08)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ fontSize: 15 }}>⏏</span>
                          Disconnect Wallet
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="font-sans text-xs border transition-all duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] disabled:opacity-50"
                style={{
                  color: 'var(--text-muted)',
                  borderColor: 'rgba(255,255,255,0.14)',
                  borderRadius: 'var(--r-pill)',
                  padding: '7px 16px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'
                }}
              >
                {isConnecting ? 'Connecting…' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* ── KPI Tiles ─────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
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
                background: '#000000',
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: 'var(--r-lg)',
                boxShadow: '0 0 0 1px rgba(45,201,100,0.06) inset',
              }}
            >
              <div className="eyebrow mb-3" style={{ color: 'var(--text-subtle)' }}>{kpi.eyebrow}</div>
              <div className="font-display leading-none" style={{ fontSize: 40, color: 'var(--text)' }}>
                {kpi.value}
                {kpi.unit && (
                  <span className="font-mono text-sm ml-1.5" style={{ color: 'var(--accent)' }}>
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
              className="w-full flex items-center justify-between font-sans text-xs"
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
        <div
          className="inline-flex items-center gap-1 p-1 mb-8 border"
          style={{
            borderRadius: 'var(--r-pill)',
            background: 'rgba(255,255,255,0.03)',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          {([{ key: 'workers', label: 'All Workers' }, { key: 'my-tasks', label: 'My Jobs' }] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="font-sans font-medium text-xs transition-all duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{
                padding: '7px 18px',
                borderRadius: 'var(--r-pill)',
                background: tab === key ? 'var(--accent)' : 'transparent',
                color: tab === key ? '#07080B' : 'var(--text-muted)',
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
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
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
                            : '1px solid rgba(255,255,255,0.08)',
                          background: filter === opt.key
                            ? 'rgba(45,201,100,0.12)'
                            : 'rgba(255,255,255,0.03)',
                          color: filter === opt.key ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div ref={sortDropdownRef} className="relative sm:ml-auto">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={sortDropdownOpen}
                      onClick={() => setSortDropdownOpen((open) => !open)}
                      className="min-w-[128px] flex items-center justify-between gap-3 font-mono text-xs focus:outline-none cursor-pointer transition-colors"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--text-muted)',
                        borderRadius: 'var(--r-md)',
                        padding: '7px 10px 7px 12px',
                      }}
                    >
                      <span>{selectedSortLabel}</span>
                      <span
                        aria-hidden="true"
                        className="transition-transform"
                        style={{
                          width: 0,
                          height: 0,
                          borderLeft: '4px solid transparent',
                          borderRight: '4px solid transparent',
                          borderTop: '5px solid var(--text-subtle)',
                          transform: sortDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      />
                    </button>

                    {sortDropdownOpen && (
                      <div
                        role="listbox"
                        aria-label="Sort workers"
                        className="absolute right-0 top-[calc(100%+6px)] z-40 w-full min-w-[148px] overflow-hidden border p-1"
                        style={{
                          background: '#111111',
                          borderColor: 'rgba(255,255,255,0.14)',
                          borderRadius: 'var(--r-md)',
                          boxShadow: '0 16px 36px rgba(0,0,0,0.65)',
                        }}
                      >
                        {sortOptions.map((opt) => {
                          const active = sort === opt.key

                          return (
                            <button
                              key={opt.key}
                              type="button"
                              role="option"
                              aria-selected={active}
                              onClick={() => {
                                setSort(opt.key)
                                setSortDropdownOpen(false)
                              }}
                              className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left font-mono text-xs transition-colors"
                              style={{
                                color: active ? 'var(--text)' : 'var(--text-muted)',
                                background: active ? 'rgba(45,201,100,0.1)' : 'transparent',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = active
                                  ? 'rgba(45,201,100,0.14)'
                                  : 'rgba(255,255,255,0.06)'
                                e.currentTarget.style.color = 'var(--text)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = active
                                  ? 'rgba(45,201,100,0.1)'
                                  : 'transparent'
                                e.currentTarget.style.color = active ? 'var(--text)' : 'var(--text-muted)'
                              }}
                            >
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: active ? 'var(--accent)' : 'rgba(255,255,255,0.18)' }}
                              />
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
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

        {/* Bottom note */}
        <div className="mt-12 text-center font-mono text-xs" style={{ color: 'var(--text-subtle)' }}>
          0G Galileo Testnet · Chain ID 16602
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
