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
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function timeAgo(ts: number) {
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
    { key: 'all', label: 'All' },
    { key: 'task', label: 'Tasks' },
    { key: 'payment', label: 'Payments' },
    { key: 'score', label: 'Scores' },
  ]

  return (
    <div className="bg-[#111111] border border-[#222222] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Activity Feed</h3>
        <div className="flex gap-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeFilter === tab.key
                  ? 'bg-[#333333] text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event list */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-3 px-4 border-b border-[#1a1a1a] animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#222222] rounded" />
                  <div className="flex-1">
                    <div className="h-3 bg-[#222222] rounded w-3/4 mb-2" />
                    <div className="h-2.5 bg-[#222222] rounded w-1/2" />
                  </div>
                  <div className="h-2.5 bg-[#222222] rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            Failed to load activity
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm px-4">
            No activity yet. Start the orchestrator to see live events.
          </div>
        ) : (
          filtered.map((event) => (
            <div key={event.id} className="py-3 px-4 border-b border-[#1a1a1a] last:border-b-0 hover:bg-[#0f0f0f] transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-base flex-shrink-0 mt-0.5">{eventIcons[event.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 leading-snug">{event.summary}</p>
                  {event.actors.length > 0 && (
                    <div className="flex flex-wrap gap-x-2 mt-1">
                      {event.actors.map((actor) => (
                        <Link
                          key={actor}
                          href={`/workers/${actor}`}
                          className="font-mono text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {formatAddr(actor)}
                        </Link>
                      ))}
                    </div>
                  )}
                  {event.txHash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-gray-500 hover:text-gray-300 transition-colors mt-0.5 inline-block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {formatAddr(event.txHash)} ↗
                    </a>
                  )}
                </div>
                <span className="text-xs text-gray-600 flex-shrink-0 mt-0.5">
                  {timeAgo(event.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
