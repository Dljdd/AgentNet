'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import useSWR from 'swr'
import ScoreTimeline from '@/components/ScoreTimeline'
import logoImg from '@/assets/logo.jpeg'

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

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const statusConfig: Record<AgentStatus, { tick: string; text: string; label: string; pulse: boolean }> = {
  idle:    { tick: '#262C39', text: 'var(--text-muted)', label: 'Idle',    pulse: false },
  working: { tick: '#2DC964', text: '#2DC964',           label: 'Live',    pulse: true },
  error:   { tick: '#F26B61', text: '#F26B61',           label: 'Error',   pulse: false },
  offline: { tick: '#262C39', text: 'var(--text-subtle)', label: 'Offline', pulse: false },
}

const capabilityStyles: Record<TaskType, { bg: string; text: string; border: string }> = {
  'pool-indexer':       { bg: 'rgba(45,201,100,0.08)',  text: '#19B254', border: 'rgba(45,201,100,0.2)' },
  'wallet-summarizer':  { bg: 'rgba(129,105,216,0.08)', text: '#8169D8', border: 'rgba(129,105,216,0.2)' },
  'token-fact-checker': { bg: 'rgba(245,176,65,0.08)',  text: '#F5B041', border: 'rgba(245,176,65,0.2)' },
}

function scoreAccentColor(score: number): string {
  if (score >= 7500) return '#2DC964'
  if (score >= 5000) return '#F5B041'
  return '#F26B61'
}

const PROFILE_IMAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(
  (n) => require(`@/assets/Profileimg/${n}.png`)
)

function getProfileImage(address: string) {
  const idx = parseInt(address.slice(-4), 16) % PROFILE_IMAGES.length
  return PROFILE_IMAGES[idx]
}

const cardStyle = {
  background: '#000000',
  borderColor: 'rgba(255,255,255,0.1)',
  borderRadius: 'var(--r-lg)',
  boxShadow: '0 0 0 1px rgba(45,201,100,0.06) inset',
}

interface WorkerDetailPageProps {
  params: { address: string }
}

export default function WorkerDetailPage({ params }: WorkerDetailPageProps) {
  const { address } = params
  const [copied, setCopied] = useState(false)

  const { data: workersData, isLoading } = useSWR<WorkerListItem[]>('/api/workers', fetcher, {
    refreshInterval: 10000,
  })

  const workers = Array.isArray(workersData) ? workersData : []
  const worker = workers.find((w) => w.address.toLowerCase() === address.toLowerCase())

  const handleCopy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  /* ── Navbar (shared) ──────────────────────────────── */
  const Navbar = (
    <nav
      className="sticky top-0 z-50 border-b backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <Image src={logoImg} alt="AgentNet logo" width={28} height={28} className="rounded-md" />
          <span className="text-xl" style={{ fontFamily: 'var(--font-logo)' }}>
            Agent<span style={{ color: 'var(--accent)' }}>Net</span>
          </span>
        </Link>
        <span className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
        <Link
          href="/explorer"
          className="font-mono text-xs transition-colors"
          style={{ color: 'var(--text-subtle)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
        >
          Explorer
        </Link>
        <span className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
        <span
          className="hidden sm:block font-mono text-xs px-2 py-0.5 rounded"
          style={{
            color: 'var(--text-subtle)',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          Worker Detail
        </span>
      </div>
    </nav>
  )

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: '#000000', color: 'var(--text)' }}>
        {Navbar}
        <div className="flex items-center justify-center py-32">
          <div className="font-mono text-sm" style={{ color: 'var(--text-subtle)' }}>
            Loading worker data…
          </div>
        </div>
      </div>
    )
  }

  if (!worker) {
    return (
      <div className="min-h-screen" style={{ background: '#000000', color: 'var(--text)' }}>
        {Navbar}
        <div className="max-w-6xl mx-auto px-6 py-20 flex flex-col items-center justify-center" style={{ color: 'var(--text-subtle)' }}>
          <p className="font-sans text-base mb-1">Worker not found.</p>
          <p className="font-mono text-xs">{address}</p>
        </div>
      </div>
    )
  }

  const { score } = worker
  const status = statusConfig[worker.status]
  const profileImg = getProfileImage(address)

  const gauges = [
    { label: 'Accuracy',   value: score.accuracy,   description: 'Task result correctness',     accentLilac: false },
    { label: 'Timeliness', value: score.timeliness,  description: 'Delivery within deadline',    accentLilac: false },
    { label: 'Uptime',     value: score.uptime,      description: 'Availability over time',      accentLilac: false },
    { label: 'Composite',  value: score.composite,   description: 'acc 50% · tim 30% · upt 20%', accentLilac: true },
  ] as const

  return (
    <div className="min-h-screen" style={{ background: '#000000', color: 'var(--text)' }}>
      {Navbar}

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        {/* ── Worker header card ──────────────────────────── */}
        <div className="p-5 border" style={cardStyle}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full flex-shrink-0 overflow-hidden">
                <Image
                  src={profileImg}
                  alt="agent avatar"
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="mb-1.5">
                  <span
                    className="status-badge"
                    style={{
                      color: status.text,
                      borderColor: `${status.tick}40`,
                      background: `${status.tick}10`,
                    }}
                  >
                    <span
                      className={`tick ${status.pulse ? 'pulse-dot' : ''}`}
                      style={{ background: status.tick }}
                    />
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-sm break-all"
                    style={{ color: 'var(--text-muted)', letterSpacing: '-0.01em' }}
                  >
                    {address}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="font-mono text-[10px] flex-shrink-0 transition-colors"
                    style={{ color: 'var(--text-subtle)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
                    title="Copy address"
                  >
                    {copied ? '✓' : '⧉'}
                  </button>
                </div>
              </div>
            </div>

            {/* Capability chips */}
            <div className="flex flex-wrap gap-1.5">
              {worker.capabilities.map((cap) => {
                const s = capabilityStyles[cap]
                return (
                  <span
                    key={cap}
                    className="font-mono text-[10px] border"
                    style={{
                      background: s.bg,
                      color: s.text,
                      borderColor: s.border,
                      borderRadius: 'var(--r-pill)',
                      padding: '3px 10px',
                    }}
                  >
                    {cap}
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Score gauges ────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {gauges.map((gauge) => {
            const accent = scoreAccentColor(gauge.value)
            const valStr = (gauge.value / 10000).toFixed(3)
            const [intPart, decPart] = valStr.split('.')

            return (
              <div
                key={gauge.label}
                className="p-4 border"
                style={{
                  background: '#000000',
                  borderColor: gauge.accentLilac ? 'rgba(129,105,216,0.3)' : 'rgba(255,255,255,0.1)',
                  borderRadius: 'var(--r-lg)',
                  boxShadow: gauge.accentLilac
                    ? '0 0 0 1px rgba(129,105,216,0.08) inset'
                    : '0 0 0 1px rgba(45,201,100,0.06) inset',
                }}
              >
                <div className="eyebrow mb-1.5">{gauge.label}</div>
                {gauge.accentLilac ? (
                  <div className="font-display leading-none" style={{ fontSize: 32, color: 'var(--accent-2)' }}>
                    <em style={{ fontStyle: 'italic' }}>{intPart}</em>
                    <span style={{ color: 'var(--text-subtle)' }}>.</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 22 }}>{decPart}</span>
                  </div>
                ) : (
                  <div className="font-display leading-none" style={{ fontSize: 26 }}>
                    <em style={{ color: accent, fontStyle: 'italic' }}>{intPart}</em>
                    <span style={{ color: 'var(--text-subtle)' }}>.</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>{decPart}</span>
                  </div>
                )}
                <div className="font-mono text-[10px] mt-2" style={{ color: 'var(--text-subtle)' }}>
                  {gauge.description}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Score Timeline ───────────────────────────────── */}
        <ScoreTimeline address={address} />

        {/* ── Worker info table ────────────────────────────── */}
        <div className="border overflow-hidden" style={cardStyle}>
          <div
            className="px-5 py-3 border-b"
            style={{ background: '#000000', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <span className="eyebrow">Worker Info</span>
          </div>
          <div>
            {[
              { label: 'Fee Per Job',   value: `${worker.feePerTask} OG`,         mono: false },
              { label: 'Total Jobs',    value: score.totalJobs.toLocaleString(),   mono: false },
              { label: 'Capabilities', value: worker.capabilities.join(', '),      mono: false },
              { label: 'Last Updated', value: timeAgo(score.lastUpdated),          mono: false },
              { label: 'Address',      value: address,                             mono: true },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                className="flex justify-between gap-4 px-5 py-3 border-b text-sm"
                style={{ borderColor: i === arr.length - 1 ? 'transparent' : 'rgba(255,255,255,0.06)' }}
              >
                <span
                  className="font-mono text-[11px] uppercase tracking-[0.06em] flex-shrink-0"
                  style={{ color: 'var(--text-subtle)' }}
                >
                  {row.label}
                </span>
                <span
                  className={`text-right break-all ${row.mono ? 'font-mono text-xs' : 'font-sans text-sm'}`}
                  style={{ color: 'var(--text-muted)' }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recent Activity ──────────────────────────────── */}
        <div>
          <div className="eyebrow mb-3">Recent Activity</div>
          <ActivityFeedForAddress address={address} />
        </div>

      </div>
    </div>
  )
}

/* ── Filtered activity feed for this worker ─────────── */
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

  const eventDot: Record<ActivityEvent['type'], string> = {
    task: '#2DC964', payment: '#F5B041', score: '#8169D8',
  }
  const eventLabel: Record<ActivityEvent['type'], string> = {
    task: 'Job', payment: 'Payment', score: 'Score',
  }

  function localTimeAgo(ts: number) {
    const s = Math.floor((Date.now() - ts) / 1000)
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
  }

  const cardStyle = {
    background: '#000000',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 'var(--r-lg)',
    boxShadow: '0 0 0 1px rgba(45,201,100,0.06) inset',
  }

  if (isLoading) {
    return (
      <div className="border p-4 space-y-3 animate-pulse" style={cardStyle}>
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-2 h-2 rounded-full mt-1.5" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="flex-1">
              <div className="h-2.5 rounded w-3/4 mb-2" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="h-2 rounded w-1/2" style={{ background: 'rgba(255,255,255,0.05)' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div
        className="border p-6 text-center font-sans text-sm"
        style={{ ...cardStyle, color: 'var(--text-subtle)' }}
      >
        No activity yet for this worker.
      </div>
    )
  }

  return (
    <div className="border overflow-hidden" style={cardStyle}>
      <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {filtered.map((event) => (
          <div
            key={event.id}
            className="py-3 px-4 flex items-start gap-3 transition-colors"
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background =
                'color-mix(in oklab, var(--accent) 4%, transparent)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
              style={{ background: eventDot[event.type] }}
            />
            <div className="flex-1 min-w-0">
              <div
                className="font-mono text-[9px] uppercase tracking-[0.08em] mb-0.5"
                style={{ color: eventDot[event.type] }}
              >
                {eventLabel[event.type]}
              </div>
              <p className="font-sans text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
                {event.summary}
              </p>
              {event.txHash && (
                <a
                  href={`https://chainscan-galileo.0g.ai/tx/${event.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] mt-0.5 inline-block transition-colors"
                  style={{ color: 'var(--text-subtle)', letterSpacing: '-0.01em' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
                >
                  {event.txHash.slice(0, 10)}… ↗
                </a>
              )}
            </div>
            <span
              className="font-mono text-[10px] flex-shrink-0 mt-0.5"
              style={{ color: 'var(--text-subtle)' }}
            >
              {localTimeAgo(event.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
