'use client'

import { useState, useEffect } from 'react'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'

// WorkerRegistry is deployed on Sepolia — not 0G.
const WORKER_REGISTRY = '0x31A664dA982495c9496C1626fE25cBFcE7Ab22a5' as `0x${string}`
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'

const REGISTRY_ABI = [
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'metadataUri', type: 'string' },
      { name: 'feePerTask', type: 'uint256' },
      { name: 'capabilities', type: 'string[]' },
    ],
    outputs: [],
  },
  {
    name: 'isRegistered',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'worker', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getWorker',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [
      {
        components: [
          { name: 'wallet', type: 'address' },
          { name: 'metadataUri', type: 'string' },
          { name: 'feePerTask', type: 'uint256' },
          { name: 'capabilities', type: 'string[]' },
          { name: 'active', type: 'bool' },
          { name: 'registeredAt', type: 'uint256' },
        ],
        type: 'tuple',
      },
    ],
  },
] as const

type Capability = 'pool-indexer' | 'wallet-summarizer' | 'token-fact-checker'

interface WorkerInfo {
  wallet: string
  metadataUri: string
  feePerTask: bigint
  capabilities: string[]
  active: boolean
  registeredAt: bigint
}

interface RegisterWorkerModalProps {
  open: boolean
  onClose: () => void
  address: string
  writeContract: (params: {
    address: `0x${string}`
    abi: readonly object[]
    functionName: string
    args: unknown[]
  }) => Promise<`0x${string}`>
  waitForTx: (hash: `0x${string}`) => Promise<unknown>
}

const CAPABILITIES: { key: Capability; label: string; color: string }[] = [
  { key: 'pool-indexer', label: 'Pool Indexer', color: 'blue' },
  { key: 'wallet-summarizer', label: 'Wallet Summarizer', color: 'purple' },
  { key: 'token-fact-checker', label: 'Token Fact-Checker', color: 'orange' },
]

const capColor: Record<string, string> = {
  blue: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
  purple: 'border-purple-500/40 bg-purple-500/10 text-purple-400',
  orange: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
}

export default function RegisterWorkerModal({
  open,
  onClose,
  address,
  writeContract,
  waitForTx,
}: RegisterWorkerModalProps) {
  const [checking, setChecking] = useState(true)
  const [isRegistered, setIsRegistered] = useState(false)
  const [existingWorker, setExistingWorker] = useState<WorkerInfo | null>(null)
  const [capabilities, setCapabilities] = useState<Capability[]>(['pool-indexer'])
  const [feeOG, setFeeOG] = useState('0.01')
  const [status, setStatus] = useState<'idle' | 'signing' | 'pending' | 'success' | 'error'>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC, { timeout: 15000 }),
  })

  useEffect(() => {
    if (!open || !address) return
    setChecking(true)
    setStatus('idle')
    setTxHash(null)
    setErrMsg(null)

    Promise.all([
      publicClient.readContract({
        address: WORKER_REGISTRY,
        abi: REGISTRY_ABI,
        functionName: 'isRegistered',
        args: [address as `0x${string}`],
      }),
      publicClient.readContract({
        address: WORKER_REGISTRY,
        abi: REGISTRY_ABI,
        functionName: 'getWorker',
        args: [address as `0x${string}`],
      }),
    ])
      .then(([registered, workerInfo]) => {
        setIsRegistered(registered as boolean)
        if (registered) setExistingWorker(workerInfo as WorkerInfo)
      })
      .catch(() => {})
      .finally(() => setChecking(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, address])

  const toggleCap = (cap: Capability) => {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    )
  }

  const handleRegister = async () => {
    if (capabilities.length === 0) {
      setErrMsg('Select at least one capability.')
      return
    }
    const fee = parseFloat(feeOG)
    if (isNaN(fee) || fee <= 0) {
      setErrMsg('Enter a valid fee.')
      return
    }
    setErrMsg(null)
    setStatus('signing')
    try {
      const feeWei = BigInt(Math.floor(fee * 1e18))
      const metadataUri = `ipfs://agentnet/worker/${address}`
      const hash = await writeContract({
        address: WORKER_REGISTRY,
        abi: REGISTRY_ABI,
        functionName: 'register',
        args: [metadataUri, feeWei, capabilities],
      })
      setTxHash(hash)
      setStatus('pending')
      await waitForTx(hash)
      setStatus('success')
      setIsRegistered(true)
    } catch (e: unknown) {
      setErrMsg((e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error).message ?? 'Transaction failed')
      setStatus('error')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#0e0e0e] border border-[#222] rounded-2xl w-full max-w-md shadow-2xl z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
          <div>
            <h2 className="text-sm font-semibold text-white">Worker Registration</h2>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{address.slice(0, 6)}...{address.slice(-4)}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#222]">
            ✕
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {checking ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              <span className="text-xs text-gray-500 ml-3">Checking registration status…</span>
            </div>
          ) : isRegistered && existingWorker && status !== 'success' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-xs">✓</span>
                <span className="text-sm font-medium">Already registered</span>
              </div>
              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 space-y-2">
                <Row label="Fee per Task" value={`${(Number(existingWorker.feePerTask) / 1e18).toFixed(4)} OG`} />
                <Row label="Status" value={existingWorker.active ? 'Active' : 'Inactive'} />
                <Row
                  label="Capabilities"
                  value={existingWorker.capabilities.join(', ') || 'None'}
                />
                <Row
                  label="Registered"
                  value={new Date(Number(existingWorker.registeredAt) * 1000).toLocaleDateString()}
                />
              </div>
              <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#1a1a1a] border border-[#333] text-xs text-gray-300 hover:text-white transition-colors">
                Close
              </button>
            </div>
          ) : status === 'success' ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-2xl mx-auto">✓</div>
              <p className="text-sm font-semibold text-green-400">Registered Successfully!</p>
              <p className="text-xs text-gray-500">Your wallet is now a worker on AgentNet.</p>
              {txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400 hover:underline block"
                >
                  View on Explorer →
                </a>
              )}
              <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#1a1a1a] border border-[#333] text-xs text-gray-300 hover:text-white transition-colors">
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Capabilities */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Capabilities</p>
                <div className="flex flex-wrap gap-2">
                  {CAPABILITIES.map(({ key, label, color }) => (
                    <button
                      key={key}
                      onClick={() => toggleCap(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        capabilities.includes(key)
                          ? capColor[color]
                          : 'border-[#333] text-gray-600 hover:border-[#444] hover:text-gray-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fee */}
              <div>
                <p className="text-xs text-gray-400 mb-1">Fee per Task (OG)</p>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={feeOG}
                  onChange={(e) => setFeeOG(e.target.value)}
                  className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-[#444]"
                />
                <p className="text-[10px] text-gray-600 mt-1">= {(parseFloat(feeOG || '0') * 1e18).toFixed(0)} wei</p>
              </div>

              {errMsg && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{errMsg}</p>
              )}

              {status === 'pending' && txHash && (
                <div className="flex items-center gap-2 text-yellow-400 text-xs">
                  <div className="w-3 h-3 rounded-full border border-yellow-400 border-t-transparent animate-spin" />
                  <span>Transaction pending…</span>
                  <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline ml-auto">
                    View tx
                  </a>
                </div>
              )}

              <button
                onClick={handleRegister}
                disabled={status === 'signing' || status === 'pending'}
                className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'signing' ? 'Waiting for signature…' : status === 'pending' ? 'Confirming…' : 'Register as Worker'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className="text-[10px] text-gray-200">{value}</span>
    </div>
  )
}
