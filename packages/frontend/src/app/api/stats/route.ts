// GET /api/stats — M-25
import { createPublicClient, http, defineChain } from 'viem'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

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
    name: 'getTotalTasks',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getTotalPayments',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
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

interface StatsResponse {
  totalWorkers: number
  totalTasks: number
  totalPayments: number
  avgReputation: number
  totalFeesEarned: string
}

function computeSeedStats(): StatsResponse {
  const seedPath = join(process.cwd(), '../../scripts/seed-output.json')
  if (!existsSync(seedPath)) {
    return { totalWorkers: 3, totalTasks: 87, totalPayments: 74, avgReputation: 7198, totalFeesEarned: '0.87 OG' }
  }
  try {
    const raw = JSON.parse(readFileSync(seedPath, 'utf8'))
    const workers: Array<{ composite: number; totalJobs: number }> = raw.workers ?? []
    const totalWorkers = workers.length
    const totalTasks = workers.reduce((s, w) => s + w.totalJobs, 0)
    const totalPayments = Math.floor(totalTasks * 0.85)
    const avgReputation = totalWorkers > 0
      ? Math.round(workers.reduce((s, w) => s + w.composite, 0) / totalWorkers)
      : 0
    const totalFees = (totalTasks * 0.01).toFixed(2)
    return { totalWorkers, totalTasks, totalPayments, avgReputation, totalFeesEarned: `${totalFees} OG` }
  } catch {
    return { totalWorkers: 3, totalTasks: 87, totalPayments: 74, avgReputation: 7198, totalFeesEarned: '0.87 OG' }
  }
}

const MOCK_STATS: StatsResponse = computeSeedStats()

export async function GET(): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  }

  try {
    const client = createPublicClient({
      chain: zgGalileo,
      transport: http('https://evmrpc-testnet.0g.ai', { timeout: 10000 }),
    })

    const [activeWorkers, totalTasks, totalPayments] = await Promise.all([
      client
        .readContract({
          address: WORKER_REGISTRY,
          abi: WORKER_REGISTRY_ABI,
          functionName: 'getActiveWorkers',
        })
        .catch(() => [] as readonly `0x${string}`[]),
      client
        .readContract({
          address: WORKER_REGISTRY,
          abi: WORKER_REGISTRY_ABI,
          functionName: 'getTotalTasks',
        })
        .catch(() => 0n),
      client
        .readContract({
          address: WORKER_REGISTRY,
          abi: WORKER_REGISTRY_ABI,
          functionName: 'getTotalPayments',
        })
        .catch(() => 0n),
    ])

    const totalWorkers = activeWorkers.length

    // If we got no useful data from chain, fall back to mock
    if (totalWorkers === 0 && Number(totalTasks) === 0) {
      return Response.json(MOCK_STATS, { headers })
    }

    // Fetch reputation scores for composite average
    const scoreResults = await Promise.allSettled(
      activeWorkers.map((addr) =>
        client.readContract({
          address: REPUTATION_ORACLE,
          abi: REPUTATION_ORACLE_ABI,
          functionName: 'getScore',
          args: [addr],
        }),
      ),
    )

    const compositeScores = scoreResults
      .filter(
        (r): r is PromiseFulfilledResult<{ composite: bigint; totalJobs: bigint; accuracy: bigint; timeliness: bigint; uptime: bigint; lastUpdated: bigint }> =>
          r.status === 'fulfilled',
      )
      .map((r) => Number(r.value.composite))

    const avgReputation =
      compositeScores.length > 0
        ? Math.round(
            compositeScores.reduce((sum, s) => sum + s, 0) /
              compositeScores.length,
          )
        : 0

    const taskCount = Number(totalTasks)
    const paymentCount = Number(totalPayments)

    // Rough fee estimate: avgFee ~0.01 OG per task
    const estimatedFees = (taskCount * 0.01).toFixed(2)

    const stats: StatsResponse = {
      totalWorkers,
      totalTasks: taskCount,
      totalPayments: paymentCount,
      avgReputation,
      totalFeesEarned: `${estimatedFees} OG`,
    }

    return Response.json(stats, { headers })
  } catch {
    return Response.json(MOCK_STATS, { headers })
  }
}
