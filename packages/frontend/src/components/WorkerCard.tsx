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

function formatAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

/* Status badge tick colors per design spec */
const statusConfig: Record<AgentStatus, { tick: string; text: string; label: string; pulse: boolean }> = {
  idle:    { tick: '#262C39', text: 'var(--text-muted)', label: 'Idle', pulse: false },
  working: { tick: '#2DC964', text: '#2DC964',           label: 'Live', pulse: true },
  error:   { tick: '#F26B61', text: '#F26B61',           label: 'Error', pulse: false },
  offline: { tick: '#262C39', text: 'var(--text-subtle)', label: 'Offline', pulse: false },
}

const capabilityStyles: Record<TaskType, { bg: string; text: string; border: string }> = {
  'pool-indexer':      { bg: 'rgba(45,201,100,0.08)',  text: '#19B254', border: 'rgba(45,201,100,0.2)' },
  'wallet-summarizer': { bg: 'rgba(129,105,216,0.08)', text: '#8169D8', border: 'rgba(129,105,216,0.2)' },
  'token-fact-checker':{ bg: 'rgba(245,176,65,0.08)',  text: '#F5B041', border: 'rgba(245,176,65,0.2)' },
}

/* Score color by threshold */
function scoreAccentColor(score: number): string {
  if (score >= 7500) return '#2DC964'   /* bio-400 */
  if (score >= 5000) return '#F5B041'   /* amber-400 */
  return '#F26B61'                       /* coral-400 */
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
      setTimeout(() => setCopied(false), 1200)
    })
  }

  const status = statusConfig[worker.status]
  const accentColor = scoreAccentColor(worker.score.composite)
  const scoreStr = (worker.score.composite / 10000).toFixed(3)
  const [intPart, decPart] = scoreStr.split('.')

  return (
    <div
      onClick={onClick}
      className="cursor-pointer border transition-all duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: '20px',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
      }}
    >
      {/* Top row: Avatar + address + status badge */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="w-11 h-11 rounded-full flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            }}
          />
          <div>
            <div className="font-mono text-sm" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {formatAddr(worker.address)}
            </div>
            <button
              onClick={handleCopy}
              className="font-mono text-[10px] mt-0.5 transition-colors"
              style={{ color: 'var(--text-subtle)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
              title="Copy address"
            >
              {copied ? '✓ copied' : '⧉ copy'}
            </button>
          </div>
        </div>

        {/* Status badge */}
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

      {/* Score — display serif, italic accent on significant digits */}
      <div className="mb-4">
        <div className="eyebrow mb-2">Reputation Score</div>
        <div className="font-display leading-none" style={{ fontSize: 28 }}>
          <em style={{ color: accentColor, fontStyle: 'italic' }}>{intPart}</em>
          <span style={{ color: 'var(--text-subtle)' }}>.</span>
          <span style={{ color: 'var(--text-muted)' }}>{decPart}</span>
          <span className="font-mono text-xs ml-2" style={{ color: 'var(--text-subtle)', fontSize: 11 }}>
            / 1.000
          </span>
        </div>
      </div>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1.5 mb-4">
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
                padding: '3px 8px',
              }}
            >
              {cap}
            </span>
          )
        })}
      </div>

      {/* Footer stats */}
      <div
        className="flex items-center justify-between font-mono text-[11px] pt-4 border-t"
        style={{ color: 'var(--text-subtle)', borderColor: 'var(--border)' }}
      >
        <span>{worker.feePerTask} OG / job</span>
        <span>{worker.score.totalJobs.toLocaleString()} jobs</span>
        <span>{timeAgo(worker.score.lastUpdated)}</span>
      </div>
    </div>
  )
}
