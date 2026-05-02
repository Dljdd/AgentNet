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
    <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-2">
        {label ? new Date(label).toLocaleString() : ''}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-4" style={{ color: entry.color }}>
          <span className="capitalize">{entry.name}</span>
          <span className="font-mono font-bold">{(entry.value / 100).toFixed(1)}%</span>
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

  if (isLoading) {
    return (
      <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
        <div className="flex items-center justify-center h-[280px] text-gray-500 text-sm">
          Loading chart...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
        <div className="flex items-center justify-center h-[280px] text-gray-500 text-sm">
          No score history
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300">Score Timeline</h3>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-[#333333] text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-[280px] text-gray-500 text-sm">
          No score history
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <XAxis
              dataKey="timestamp"
              tickFormatter={(v: number) => formatXAxis(v, range)}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={{ stroke: '#222222' }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[0, 10000]}
              tickFormatter={(v: number) => (v / 100).toFixed(0) + '%'}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', color: '#9ca3af', paddingTop: '8px' }}
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
