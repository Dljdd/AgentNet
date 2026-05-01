'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useSWR from 'swr'

type TaskType = 'pool-indexer' | 'wallet-summarizer' | 'token-fact-checker'
type AgentStatus = 'idle' | 'working' | 'error' | 'offline'

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

function scoreBg(score: number) {
  if (score >= 7500) return 'bg-green-400'
  if (score >= 5000) return 'bg-yellow-400'
  return 'bg-red-400'
}

function formatAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface WorkerSelectorProps {
  taskType: TaskType
  onSelect: (address: string) => void
}

export default function WorkerSelector({ taskType, onSelect }: WorkerSelectorProps) {
  const [demoMode, setDemoMode] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [autoSelected, setAutoSelected] = useState(false)

  const { data, isLoading } = useSWR<WorkerListItem[]>(
    `/api/workers?capability=${taskType}&sortBy=score`,
    fetcher
  )

  const workers = Array.isArray(data) ? data : []

  // Demo mode auto-select countdown
  useEffect(() => {
    if (!demoMode || workers.length === 0 || autoSelected) return
    setCountdown(3)
    setAutoSelected(false)

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setAutoSelected(true)
          onSelect(workers[0].address)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [demoMode, workers, onSelect, autoSelected])

  // Reset auto-selected when demo mode turns off
  useEffect(() => {
    if (!demoMode) {
      setAutoSelected(false)
      setCountdown(3)
    }
  }, [demoMode])

  return (
    <div className="bg-[#111111] border border-[#222222] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-300">Select Worker</h3>
          <p className="text-xs text-gray-500 mt-0.5 capitalize">{taskType}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Demo Mode</span>
          <button
            onClick={() => setDemoMode((v) => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              demoMode ? 'bg-blue-500' : 'bg-[#333333]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                demoMode ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Demo mode banner */}
      <AnimatePresence>
        {demoMode && !autoSelected && workers.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 text-xs text-blue-400 text-center">
              Auto-selecting top worker in {countdown}...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Worker list */}
      <div className="divide-y divide-[#1a1a1a]">
        {isLoading ? (
          <div className="space-y-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-3 animate-pulse flex items-center gap-3">
                <div className="w-6 h-4 bg-[#222222] rounded" />
                <div className="flex-1">
                  <div className="h-3 bg-[#222222] rounded w-1/2 mb-2" />
                  <div className="h-2 bg-[#222222] rounded w-3/4" />
                </div>
                <div className="w-16 h-7 bg-[#222222] rounded" />
              </div>
            ))}
          </div>
        ) : workers.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No workers available for {taskType}
          </div>
        ) : (
          <AnimatePresence>
            {workers.map((worker, index) => {
              const isTop = index === 0
              const isUnreliable = worker.score.composite < 1000
              const isLowRep = worker.score.composite < 3000 && !isUnreliable
              const barWidth = Math.min(100, (worker.score.composite / 10000) * 100)

              return (
                <motion.div
                  key={worker.address}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`px-4 py-3 ${
                    isTop
                      ? 'bg-yellow-400/10 border-l-2 border-yellow-400/50'
                      : 'hover:bg-[#0f0f0f]'
                  } ${isUnreliable ? 'opacity-50' : ''} transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <span className="text-xs text-gray-600 w-5 text-center font-mono">
                      #{index + 1}
                    </span>

                    {/* Address + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span
                          className={`font-mono text-sm ${
                            isUnreliable ? 'line-through text-gray-600' : 'text-gray-300'
                          }`}
                        >
                          {formatAddr(worker.address)}
                        </span>
                        {isTop && (
                          <span className="text-xs bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 px-1.5 py-0.5 rounded-full">
                            ⭐ Recommended
                          </span>
                        )}
                        {isLowRep && (
                          <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                            ⚠ Low Reputation
                          </span>
                        )}
                        {isUnreliable && (
                          <span className="text-xs bg-gray-500/20 text-gray-500 border border-gray-500/30 px-1.5 py-0.5 rounded-full">
                            Filtered — Unreliable
                          </span>
                        )}
                      </div>

                      {/* Score bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-[#222222] rounded-full h-1.5 max-w-[120px]">
                          <div
                            className={`h-1.5 rounded-full ${scoreBg(worker.score.composite)}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className={`text-xs font-mono font-semibold ${scoreColor(worker.score.composite)}`}>
                          {worker.score.composite.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Fee */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-gray-400">{worker.feePerTask} OG</div>
                      <div className="text-xs text-gray-600">per task</div>
                    </div>

                    {/* Select button */}
                    <button
                      disabled={isUnreliable}
                      onClick={() => onSelect(worker.address)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                        isUnreliable
                          ? 'bg-[#1a1a1a] text-gray-600 cursor-not-allowed'
                          : isTop
                          ? 'bg-yellow-400 text-black hover:bg-yellow-300'
                          : 'bg-[#222222] text-gray-300 hover:bg-[#333333]'
                      }`}
                    >
                      Select
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[#1a1a1a]">
        <p className="text-xs text-gray-600 text-center">
          Workers ranked by composite reputation score (accuracy 50% · timeliness 30% · uptime 20%)
        </p>
      </div>
    </div>
  )
}
