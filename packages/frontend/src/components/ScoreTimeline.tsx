'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type TimeRange = '1h' | '24h' | '7d' | 'all'

interface ScorePoint {
  timestamp: number
  accuracy: number
  timeliness: number
  uptime: number
  composite: number
}

interface ScoresResponse {
  history?: Record<string, ScorePoint[]>
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatXAxis(timestamp: number, range: TimeRange): string {
  const date = new Date(timestamp)
  if (range === '1h' || range === '24h') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}


interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: number
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div style={{ background: '#000000', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 11, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
      <p style={{ color: 'var(--text-subtle)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
        {label ? new Date(label).toLocaleString() : ''}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-4" style={{ color: entry.color, fontFamily: 'var(--font-mono)' }}>
          <span className="capitalize">{entry.name}</span>
          <span style={{ fontWeight: 600 }}>{(entry.value / 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

interface ScoreTimelineProps {
  address: string
  timeRange?: TimeRange
}

export default function ScoreTimeline({ address, timeRange: initialRange = '24h' }: ScoreTimelineProps) {
  const [range, setRange] = useState<TimeRange>(initialRange)
  const { data, error, isLoading } = useSWR<ScoresResponse>('/api/scores', fetcher)

  const chartData = useMemo(() => {
    const raw: ScorePoint[] = data?.history?.[address] ?? []

    const now = Date.now()
    const cutoff: Record<TimeRange, number> = {
      '1h': now - 3600 * 1000,
      '24h': now - 24 * 3600 * 1000,
      '7d': now - 7 * 24 * 3600 * 1000,
      all: 0,
    }

    return raw.filter((p) => p.timestamp >= cutoff[range])
  }, [data, address, range])

  const ranges: TimeRange[] = ['1h', '24h', '7d', 'all']

  const wrapStyle = {
    background: '#000000',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 'var(--r-lg)',
    boxShadow: '0 0 0 1px rgba(45,201,100,0.06) inset',
    padding: '20px',
  }

  if (isLoading) {
    return (
      <div style={wrapStyle}>
        <div className="flex items-center justify-center h-[280px] font-mono text-sm" style={{ color: 'var(--text-subtle)' }}>
          Loading chart…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={wrapStyle}>
        <div className="flex items-center justify-center h-[280px] font-mono text-sm" style={{ color: 'var(--text-subtle)' }}>
          No score history
        </div>
      </div>
    )
  }

  return (
    <div style={wrapStyle}>
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow">Score Timeline</span>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="font-mono text-[10px] uppercase tracking-[0.06em] transition-all duration-[120ms]"
              style={{
                padding: '3px 8px',
                borderRadius: 'var(--r-xs)',
                background: range === r ? 'rgba(45,201,100,0.12)' : 'transparent',
                color: range === r ? 'var(--accent)' : 'var(--text-subtle)',
              }}
            >
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-[280px] font-mono text-sm" style={{ color: 'var(--text-subtle)' }}>
          No score history
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <XAxis
              dataKey="timestamp"
              tickFormatter={(v: number) => formatXAxis(v, range)}
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[0, 10000]}
              tickFormatter={(v: number) => (v / 100).toFixed(0) + '%'}
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', paddingTop: '8px', fontFamily: 'var(--font-mono)' }}
            />
            <Line
              type="monotone"
              dataKey="accuracy"
              stroke="#22c55e"
              dot={false}
              strokeWidth={1.5}
              name="accuracy"
            />
            <Line
              type="monotone"
              dataKey="timeliness"
              stroke="#3b82f6"
              dot={false}
              strokeWidth={1.5}
              name="timeliness"
            />
            <Line
              type="monotone"
              dataKey="uptime"
              stroke="#a855f7"
              dot={false}
              strokeWidth={1.5}
              name="uptime"
            />
            <Line
              type="monotone"
              dataKey="composite"
              stroke="#f59e0b"
              dot={false}
              strokeWidth={2}
              name="composite"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
