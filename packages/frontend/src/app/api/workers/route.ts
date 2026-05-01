// GET /api/workers — M-25
import { NextRequest } from 'next/server'
import { createPublicClient, http, formatEther, defineChain } from 'viem'
import type { WorkerListItem, TaskType, AgentStatus } from '@agentnet/types'

const zgGalileo = defineChain({
  id: 16602,
  name: '0G Galileo Testnet',
  nativeCurrency: { name: '0G', symbol: 'OG', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmrpc-testnet.0g.ai'] } },
})

const WORKER_REGISTRY = '0xde94A743D06143b08E4B49E3812D570065BEdC51' as const
const REPUTATION_ORACLE = '0x19139CDE2d0da0B148bE69cD4261AA62B9d4F125' as const

const WORKER_REGISTRY_ABI = [
  {
    name: 'getActiveWorkers',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
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

const REPUTATION_ORACLE_ABI = [
  {
    name: 'getScore',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [
      {
        components: [
          { name: 'accuracy', type: 'uint256' },
          { name: 'timeliness', type: 'uint256' },
          { name: 'uptime', type: 'uint256' },
          { name: 'composite', type: 'uint256' },
          { name: 'totalJobs', type: 'uint256' },
          { name: 'lastUpdated', type: 'uint256' },
        ],
        type: 'tuple',
      },
    ],
  },
] as const

const MOCK_WORKERS: WorkerListItem[] = [
  {
    address: '0xFBEd89164eD414729D180948c05EBa60E56a803d',
    status: 'idle',
    score: {
      accuracy: 9200,
      timeliness: 8900,
      uptime: 9500,
      composite: 9185,
      totalJobs: 47,
      lastUpdated: Date.now() - 120000,
    },
    capabilities: ['pool-indexer', 'wallet-summarizer'],
    feePerTask: '0.01',
  },
  {
    address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    status: 'working',
    score: {
      accuracy: 7400,
      timeliness: 7100,
      uptime: 8200,
      composite: 7490,
      totalJobs: 28,
      lastUpdated: Date.now() - 300000,
    },
    capabilities: ['token-fact-checker', 'pool-indexer'],
    feePerTask: '0.005',
  },
  {
    address: '0x742d35Cc6634C0532925a3b8D4C9a8B1D6f3E7A',
    status: 'idle',
    score: {
      accuracy: 4800,
      timeliness: 5200,
      uptime: 4600,
      composite: 4920,
      totalJobs: 12,
      lastUpdated: Date.now() - 600000,
    },
    capabilities: ['wallet-summarizer'],
    feePerTask: '0.003',
  },
]

function applyFilters(
  workers: WorkerListItem[],
  capability: string | null,
  sortBy: string | null,
): WorkerListItem[] {
  let result = [...workers]

  if (capability) {
    result = result.filter((w) =>
      w.capabilities.includes(capability as TaskType),
    )
  }

  if (sortBy === 'score') {
    result.sort((a, b) => b.score.composite - a.score.composite)
  } else if (sortBy === 'fee') {
    result.sort((a, b) => parseFloat(a.feePerTask) - parseFloat(b.feePerTask))
  } else if (sortBy === 'jobs') {
    result.sort((a, b) => b.score.totalJobs - a.score.totalJobs)
  }

  return result
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const capability = searchParams.get('capability')
  const sortBy = searchParams.get('sortBy')

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  }

  try {
    const client = createPublicClient({
      chain: zgGalileo,
      transport: http('https://evmrpc-testnet.0g.ai', { timeout: 10000 }),
    })

    const activeAddresses = await client.readContract({
      address: WORKER_REGISTRY,
      abi: WORKER_REGISTRY_ABI,
      functionName: 'getActiveWorkers',
    })

    if (!activeAddresses || activeAddresses.length === 0) {
      const workers = applyFilters(MOCK_WORKERS, capability, sortBy)
      return Response.json(workers, { headers })
    }

    const workerResults = await Promise.allSettled(
      activeAddresses.map(async (addr) => {
        const [workerData, scoreData] = await Promise.all([
          client.readContract({
            address: WORKER_REGISTRY,
            abi: WORKER_REGISTRY_ABI,
            functionName: 'getWorker',
            args: [addr],
          }),
          client.readContract({
            address: REPUTATION_ORACLE,
            abi: REPUTATION_ORACLE_ABI,
            functionName: 'getScore',
            args: [addr],
          }),
        ])

        const item: WorkerListItem = {
          address: addr,
          status: workerData.active ? 'idle' : ('offline' as AgentStatus),
          score: {
            accuracy: Number(scoreData.accuracy),
            timeliness: Number(scoreData.timeliness),
            uptime: Number(scoreData.uptime),
            composite: Number(scoreData.composite),
            totalJobs: Number(scoreData.totalJobs),
            lastUpdated: Number(scoreData.lastUpdated) * 1000,
          },
          capabilities: workerData.capabilities as TaskType[],
          feePerTask: formatEther(workerData.feePerTask),
        }
        return item
      }),
    )

    const workers: WorkerListItem[] = workerResults
      .filter(
        (r): r is PromiseFulfilledResult<WorkerListItem> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value)

    if (workers.length === 0) {
      const fallback = applyFilters(MOCK_WORKERS, capability, sortBy)
      return Response.json(fallback, { headers })
    }

    const filtered = applyFilters(workers, capability, sortBy)
    return Response.json(filtered, { headers })
  } catch {
    const workers = applyFilters(MOCK_WORKERS, capability, sortBy)
    return Response.json(workers, { headers })
  }
}
