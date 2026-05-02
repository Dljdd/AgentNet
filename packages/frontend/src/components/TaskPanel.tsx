'use client'

import { useState, useEffect, useRef } from 'react'

type TaskType = 'pool-indexer' | 'wallet-summarizer' | 'token-fact-checker'

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

interface TaskPanelProps {
  open: boolean
  onClose: () => void
  walletAddress: string | null
  onTaskComplete?: (task: TaskRecord) => void
}

type Step = 'type' | 'params' | 'confirm' | 'running' | 'result'

const TASK_META: Record<TaskType, { label: string; desc: string; color: string; icon: string }> = {
  'pool-indexer': {
    label: 'Pool Indexer',
    desc: 'Index Uniswap v3 pool swap events and compute volume statistics.',
    color: 'blue',
    icon: '⬡',
  },
  'wallet-summarizer': {
    label: 'Wallet Summarizer',
    desc: 'Generate a natural-language summary of on-chain wallet activity.',
    color: 'purple',
    icon: '◎',
  },
  'token-fact-checker': {
    label: 'Token Fact-Checker',
    desc: 'Analyze a token for honeypot, rug-pull, or scam indicators.',
    color: 'orange',
    icon: '◈',
  },
}

const colorClass: Record<string, string> = {
  blue: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
  purple: 'border-purple-500/50 bg-purple-500/10 text-purple-400',
  orange: 'border-orange-500/50 bg-orange-500/10 text-orange-400',
}

const DEFAULT_PARAMS: Record<TaskType, Record<string, string>> = {
  'pool-indexer': { poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', blockRange: '500' },
  'wallet-summarizer': { walletAddress: '', maxTransactions: '50' },
  'token-fact-checker': { tokenAddress: '' },
}

function fmt(addr: string) {
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

function StatusDot({ active, done }: { active: boolean; done: boolean }) {
  if (done) return <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-white">✓</span>
  if (active) return (
    <span className="w-5 h-5 rounded-full border-2 border-blue-400 flex items-center justify-center">
      <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
    </span>
  )
  return <span className="w-5 h-5 rounded-full border-2 border-[#333] flex-shrink-0" />
}

export default function TaskPanel({ open, onClose, walletAddress, onTaskComplete }: TaskPanelProps) {
  const [step, setStep] = useState<Step>('type')
  const [taskType, setTaskType] = useState<TaskType | null>(null)
  const [params, setParams] = useState<Record<string, string>>({})
  const [result, setResult] = useState<TaskRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('type')
        setTaskType(null)
        setParams({})
        setResult(null)
        setError(null)
      }, 300)
    }
  }, [open])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  const selectType = (t: TaskType) => {
    setTaskType(t)
    setParams(DEFAULT_PARAMS[t])
    setStep('params')
  }

  const submit = async () => {
    if (!taskType) return
    setStep('running')
    setError(null)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType, params, callerAddress: walletAddress }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Task failed')
        setStep('confirm')
        return
      }
      setResult(data)
      onTaskComplete?.(data)
      setStep('result')
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Network error')
      setStep('confirm')
    }
  }

  const reset = () => {
    setStep('type')
    setTaskType(null)
    setParams({})
    setResult(null)
    setError(null)
  }

  const runSteps = ['Dispatching to worker', 'Worker executing task', 'Collecting result']
  const runStepIndex = step === 'running' ? 1 : step === 'result' ? 3 : 0

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-[#0e0e0e] border-l border-[#222] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">Submit Task</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {taskType ? TASK_META[taskType].label : 'Select a task type to begin'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#222]"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* Step 1 — Task type */}
          {step === 'type' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-4">Choose what you want to run:</p>
              {(Object.entries(TASK_META) as [TaskType, typeof TASK_META[TaskType]][]).map(([type, meta]) => (
                <button
                  key={type}
                  onClick={() => selectType(type)}
                  className={`w-full text-left p-4 rounded-xl border transition-all hover:scale-[1.01] ${colorClass[meta.color]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{meta.icon}</span>
                    <span className="text-sm font-semibold">{meta.label}</span>
                  </div>
                  <p className="text-xs opacity-70">{meta.desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — Params */}
          {step === 'params' && taskType && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('type')}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
              >
                ← Back
              </button>

              <div className={`p-3 rounded-xl border ${colorClass[TASK_META[taskType].color]} mb-4`}>
                <p className="text-xs font-semibold">{TASK_META[taskType].label}</p>
                <p className="text-xs opacity-70 mt-0.5">{TASK_META[taskType].desc}</p>
              </div>

              {taskType === 'pool-indexer' && (
                <>
                  <label className="block">
                    <span className="text-xs text-gray-400 mb-1 block">Pool Address</span>
                    <input
                      value={params.poolAddress ?? ''}
                      onChange={(e) => setParams({ ...params, poolAddress: e.target.value })}
                      placeholder="0x88e6A0c2dDD..."
                      className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-[#444] font-mono"
                    />
                    <span className="text-[10px] text-gray-600 mt-1 block">Default: WETH/USDC on Ethereum mainnet</span>
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-400 mb-1 block">Block Range: {params.blockRange}</span>
                    <input
                      type="range" min="100" max="2000" step="100"
                      value={params.blockRange ?? '500'}
                      onChange={(e) => setParams({ ...params, blockRange: e.target.value })}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>100</span><span>2000 blocks</span>
                    </div>
                  </label>
                </>
              )}

              {taskType === 'wallet-summarizer' && (
                <>
                  <label className="block">
                    <span className="text-xs text-gray-400 mb-1 block">Wallet Address</span>
                    <input
                      value={params.walletAddress ?? ''}
                      onChange={(e) => setParams({ ...params, walletAddress: e.target.value })}
                      placeholder="0xd8dA6BF26964..."
                      className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-[#444] font-mono"
                    />
                  </label>
                  <div className="flex gap-2">
                    {walletAddress && (
                      <button
                        onClick={() => setParams({ ...params, walletAddress: walletAddress })}
                        className="text-[10px] text-blue-400 hover:text-blue-300 border border-blue-500/30 px-2 py-1 rounded"
                      >
                        Use my wallet
                      </button>
                    )}
                    <button
                      onClick={() => setParams({ ...params, walletAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' })}
                      className="text-[10px] text-gray-500 hover:text-gray-300 border border-[#333] px-2 py-1 rounded"
                    >
                      Use vitalik.eth
                    </button>
                  </div>
                  <label className="block">
                    <span className="text-xs text-gray-400 mb-1 block">Max Transactions: {params.maxTransactions}</span>
                    <input
                      type="range" min="10" max="100" step="10"
                      value={params.maxTransactions ?? '50'}
                      onChange={(e) => setParams({ ...params, maxTransactions: e.target.value })}
                      className="w-full accent-purple-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>10</span><span>100 txs</span>
                    </div>
                  </label>
                </>
              )}

              {taskType === 'token-fact-checker' && (
                <>
                  <label className="block">
                    <span className="text-xs text-gray-400 mb-1 block">Token Address</span>
                    <input
                      value={params.tokenAddress ?? ''}
                      onChange={(e) => setParams({ ...params, tokenAddress: e.target.value })}
                      placeholder="0x1f9840a85d5aF5..."
                      className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-[#444] font-mono"
                    />
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: 'UNI', addr: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
                      { label: 'USDC', addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
                      { label: 'PEPE', addr: '0x6982508145454Ce325dDbE47a25d4ec3d2311933' },
                    ].map(({ label, addr }) => (
                      <button
                        key={addr}
                        onClick={() => setParams({ ...params, tokenAddress: addr })}
                        className="text-[10px] text-gray-500 hover:text-gray-300 border border-[#333] px-2 py-1 rounded"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</p>
              )}
            </div>
          )}

          {/* Step 3 — Running */}
          {step === 'running' && (
            <div className="space-y-6 pt-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full border-2 border-blue-400 border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-300 font-medium">Executing task…</p>
                <p className="text-xs text-gray-500 mt-1">{taskType && TASK_META[taskType].label}</p>
              </div>
              <div className="space-y-3 mt-6">
                {runSteps.map((label, i) => (
                  <div key={label} className="flex items-center gap-3">
                    <StatusDot active={i === runStepIndex} done={i < runStepIndex} />
                    <span className={`text-xs ${i <= runStepIndex ? 'text-gray-200' : 'text-gray-600'}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 — Result */}
          {step === 'result' && result && taskType && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-xs">✓</span>
                <span className="text-sm font-semibold">Task Complete</span>
                <span className="text-xs text-gray-500 ml-auto">{result.executionMs}ms</span>
              </div>

              {/* Worker used */}
              <div className="bg-[#111] border border-[#222] rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Worker Used</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-300">{fmt(result.workerAddress)}</span>
                  <span className="text-xs text-yellow-400">Score {result.workerScore.toLocaleString()}</span>
                </div>
                <div className="text-[10px] text-gray-600 mt-1">Fee: {result.workerFee} wei</div>
              </div>

              {/* Result display */}
              <div className="bg-[#111] border border-[#222] rounded-xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Result</p>
                <TaskResult taskType={taskType} result={result.result} />
              </div>

              <button
                onClick={reset}
                className="w-full py-2 rounded-xl border border-[#333] text-xs text-gray-400 hover:text-gray-200 hover:border-[#555] transition-colors"
              >
                Submit Another Task
              </button>
            </div>
          )}
        </div>

        {/* Footer action button */}
        {(step === 'params' || step === 'confirm') && (
          <div className="px-5 py-4 border-t border-[#1a1a1a] flex-shrink-0">
            <button
              onClick={submit}
              className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              Dispatch Task →
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function TaskResult({ taskType, result }: { taskType: TaskType; result: unknown }) {
  const r = result as Record<string, unknown>

  if (taskType === 'pool-indexer') {
    return (
      <div className="space-y-2">
        <Row label="Pool" value={fmt(r.poolAddress as string)} />
        <Row label="Token Pair" value={`${(r.token0 as { symbol: string }).symbol} / ${(r.token1 as { symbol: string }).symbol}`} />
        <Row label="Swaps Found" value={String(r.swapCount)} />
        <Row label="Volume (Token0)" value={`${r.totalVolumeToken0} ${(r.token0 as { symbol: string }).symbol}`} />
        <Row label="Volume (Token1)" value={`${Number(r.totalVolumeToken1).toLocaleString()} ${(r.token1 as { symbol: string }).symbol}`} />
        <Row label="Blocks Scanned" value={`${r.blockStart?.toString()} → ${r.blockEnd?.toString()}`} />
      </div>
    )
  }

  if (taskType === 'wallet-summarizer') {
    const stats = r.stats as Record<string, unknown>
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-300 leading-relaxed">{r.summary as string}</p>
        <div className="border-t border-[#222] pt-3 space-y-2">
          <Row label="Transactions" value={String(stats.txCount)} />
          <Row label="Unique Tokens" value={String(stats.uniqueTokens)} />
          <Row label="Value Transferred" value={stats.totalValueTransferred as string} />
          <Row label="Most Active" value={stats.mostActiveProtocol as string} />
        </div>
      </div>
    )
  }

  if (taskType === 'token-fact-checker') {
    const verdictColor: Record<string, string> = {
      legit: 'text-green-400 bg-green-500/10 border-green-500/30',
      suspicious: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
      honeypot: 'text-red-400 bg-red-500/10 border-red-500/30',
      rug: 'text-red-400 bg-red-500/10 border-red-500/30',
      unknown: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
    }
    const verdict = r.verdict as string
    const checks = r.checks as Record<string, unknown>
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${verdictColor[verdict] ?? verdictColor.unknown}`}>
            {verdict}
          </span>
          <span className="text-xs text-gray-500">Confidence: {r.confidence as number}%</span>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">{r.reasoning as string}</p>
        <div className="border-t border-[#222] pt-3 space-y-1">
          {[
            { key: 'hasMintFunction', label: 'Mint Function', bad: true },
            { key: 'hasBlacklist', label: 'Blacklist', bad: true },
            { key: 'hasPausable', label: 'Pausable', bad: true },
            { key: 'liquidityLocked', label: 'Liquidity Locked', bad: false },
            { key: 'hasVerifiedSource', label: 'Verified Source', bad: false },
          ].map(({ key, label, bad }) => {
            const val = checks[key] as boolean
            const isGood = bad ? !val : val
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">{label}</span>
                <span className={`text-[10px] font-medium ${isGood ? 'text-green-400' : 'text-red-400'}`}>
                  {val ? 'Yes' : 'No'}
                </span>
              </div>
            )
          })}
          <Row label="Top Holder %" value={`${checks.topHolderConcentration}%`} />
          <Row label="Contract Age" value={`${checks.contractAge} days`} />
        </div>
      </div>
    )
  }

  return <pre className="text-[10px] text-gray-400 overflow-auto">{JSON.stringify(result, null, 2)}</pre>
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className="text-[10px] text-gray-200 font-mono">{value}</span>
    </div>
  )
}
