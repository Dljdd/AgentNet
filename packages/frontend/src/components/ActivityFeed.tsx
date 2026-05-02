'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'

interface ActivityEvent {
  id: string
  type: 'task' | 'payment' | 'score'
  summary: string
  actors: string[]
  timestamp: number
  txHash?: string
}

type FilterType = 'all' | 'task' | 'payment' | 'score'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

/* Dot colors per event type */
const eventDot: Record<ActivityEvent['type'], string> = {
  task:    '#2DC964',  /* bio-400 */
  payment: '#F5B041',  /* amber-400 */
  score:   '#8169D8',  /* lilac-400 */
}

const eventLabel: Record<ActivityEvent['type'], string> = {
  task: 'Job',
  payment: 'Payment',
  score: 'Score',
}

interface ActivityFeedProps {
  filter?: FilterType
  maxItems?: number
}

export default function ActivityFeed({ filter: initialFilter = 'all', maxItems = 50 }: ActivityFeedProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter)

  const { data, error, isLoading } = useSWR<ActivityEvent[]>('/api/activity', fetcher, {
    refreshInterval: 5000,
  })

  const events = Array.isArray(data) ? data : []
  const filtered = events
    .filter((e) => activeFilter === 'all' || e.type === activeFilter)
    .slice(0, maxItems)

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: 'all',     label: 'All' },
    { key: 'task',    label: 'Jobs' },
    { key: 'payment', label: 'Pay' },
    { key: 'score',   label: 'Score' },
  ]

  return (
    <div
      className="border overflow-hidden"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--r-lg)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-sunk)' }}
      >
        <span className="eyebrow">Activity Feed</span>
        <div className="flex gap-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className="font-mono text-[10px] uppercase tracking-[0.06em] transition-all duration-[120ms]"
              style={{
                padding: '3px 8px',
                borderRadius: 'var(--r-xs)',
                background: activeFilter === tab.key ? 'var(--border-strong)' : 'transparent',
                color: activeFilter === tab.key ? 'var(--text)' : 'var(--text-subtle)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event list */}
      <div className="max-h-[420px] overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="py-3 px-4 flex items-start gap-3 animate-pulse"
              >
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--border-strong)' }} />
                <div className="flex-1">
                  <div className="h-2.5 rounded w-3/4 mb-2" style={{ background: 'var(--border-strong)' }} />
                  <div className="h-2 rounded w-1/2" style={{ background: 'var(--border)' }} />
                </div>
                <div className="h-2 rounded w-8" style={{ background: 'var(--border)' }} />
              </div>
            ))}
          </>
        ) : error ? (
          <div className="py-8 text-center font-sans text-sm" style={{ color: 'var(--text-subtle)' }}>
            Failed to load activity.
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center font-sans text-sm px-4" style={{ color: 'var(--text-subtle)' }}>
            No activity yet. Start the orchestrator to see live events.
          </div>
        ) : (
          filtered.map((event) => (
            <div
              key={event.id}
              className="py-3 px-4 flex items-start gap-3 transition-colors"
              style={{ background: 'transparent' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background =
                  `color-mix(in oklab, var(--accent) 4%, transparent)`
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {/* Type dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                style={{ background: eventDot[event.type] }}
              />

              <div className="flex-1 min-w-0">
                {/* Type eyebrow + summary */}
                <div
                  className="font-mono text-[9px] uppercase tracking-[0.08em] mb-0.5"
                  style={{ color: eventDot[event.type] }}
                >
                  {eventLabel[event.type]}
                </div>
                <p className="font-sans text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
                  {event.summary}
                </p>

                {/* Actor links */}
                {event.actors.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 mt-1">
                    {event.actors.map((actor) => (
                      <Link
                        key={actor}
                        href={`/workers/${actor}`}
                        className="font-mono text-[10px] transition-colors"
                        style={{ color: 'var(--text-subtle)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {formatAddr(actor)}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Tx hash */}
                {event.txHash && (
                  <a
                    href={`https://chainscan-galileo.0g.ai/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] mt-0.5 inline-block transition-colors"
                    style={{ color: 'var(--text-subtle)', letterSpacing: '-0.01em' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {formatAddr(event.txHash)} ↗
                  </a>
                )}
              </div>

              {/* Timestamp */}
              <span
                className="font-mono text-[10px] flex-shrink-0 mt-0.5"
                style={{ color: 'var(--text-subtle)' }}
              >
                {timeAgo(event.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
