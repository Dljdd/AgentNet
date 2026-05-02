// GET /api/scores — M-27
import { createPublicClient, http, defineChain } from 'viem'
import { sepolia } from 'viem/chains'
import type { ReputationScore } from '@agentnet/types'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const zgGalileo = defineChain({
  id: 16602,
  name: '0G Galileo Testnet',
  nativeCurrency: { name: '0G', symbol: 'OG', decimals: 18 },
  rpcUrls: { default: { http: ['https://evmrpc-testnet.0g.ai'] } },
})

// Sepolia deployment (primary — all 25 seed workers scored here)
const SEPOLIA_ORACLE = '0xde94A743D06143b08E4B49E3812D570065BEdC51' as const
// 0G Galileo deployment (fallback — Para MPC writes currently non-functional)
const REPUTATION_ORACLE = '0x19139CDE2d0da0B148bE69cD4261AA62B9d4F125' as const

// getTopAgents returns two separate arrays: (address[], AgentScore[])
const REPUTATION_ORACLE_ABI = [
  {
    name: 'getTopAgents',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'count', type: 'uint256' }],
    outputs: [
      { name: 'agents', type: 'address[]' },
      {
        name: 'scores',
        type: 'tuple[]',
        components: [
          { name: 'accuracy', type: 'uint256' },
          { name: 'timeliness', type: 'uint256' },
          { name: 'uptime', type: 'uint256' },
          { name: 'composite', type: 'uint256' },
          { name: 'totalJobs', type: 'uint256' },
          { name: 'lastUpdated', type: 'uint256' },
        ],
      },
    ],
  },
] as const

interface ScorePoint {
  timestamp: number
  accuracy: number
  timeliness: number
  uptime: number
  composite: number
}

interface ScoresResponse {
  agents: Array<{ address: string; score: ReputationScore }>
  history: Record<string, ScorePoint[]>
}

function loadSeedAgents(): Array<{ address: string; score: ReputationScore }> {
  const seedPath = join(process.cwd(), '../../scripts/seed-output.json')
  if (!existsSync(seedPath)) return []
  try {
    const raw = JSON.parse(readFileSync(seedPath, 'utf8'))
    const workers: Array<{
      address: string; accuracy: number; timeliness: number;
      uptime: number; composite: number; totalJobs: number
    }> = raw.workers ?? []
    const now = Date.now()
    return workers.map((w, i) => ({
      address: w.address,
      score: {
        accuracy: w.accuracy,
        timeliness: w.timeliness,
        uptime: w.uptime,
        composite: w.composite,
        totalJobs: w.totalJobs,
        lastUpdated: now - i * 180000,
      },
    }))
  } catch {
    return []
  }
}

const SEED_AGENTS = loadSeedAgents()

const MOCK_AGENTS: Array<{ address: string; score: ReputationScore }> =
  SEED_AGENTS.length > 0 ? SEED_AGENTS : [
    {
      address: '0xFBEd89164eD414729D180948c05EBa60E56a803d',
      score: { accuracy: 9200, timeliness: 8900, uptime: 9500, composite: 9185, totalJobs: 47, lastUpdated: Date.now() - 120000 },
    },
    {
      address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      score: { accuracy: 7400, timeliness: 7100, uptime: 8200, composite: 7490, totalJobs: 28, lastUpdated: Date.now() - 300000 },
    },
    {
      address: '0x742d35Cc6634C0532925a3b8D4C9a8B1D6f3E7A',
      score: { accuracy: 4800, timeliness: 5200, uptime: 4600, composite: 4920, totalJobs: 12, lastUpdated: Date.now() - 600000 },
    },
  ]

function generateHistory(baseScore: ReputationScore, address: string): ScorePoint[] {
  const now = Date.now()
  const hourMs = 60 * 60 * 1000
  const seed = parseInt(address.slice(2, 6), 16)
  return Array.from({ length: 25 }, (_, i) => {
    const j = 24 - i
    const jitter = (((seed * (j + 1)) % 400) - 200)
    return {
      timestamp: now - j * hourMs,
      accuracy: Math.max(0, Math.min(10000, baseScore.accuracy + jitter)),
      timeliness: Math.max(0, Math.min(10000, baseScore.timeliness + Math.round(jitter * 0.8))),
      uptime: Math.max(0, Math.min(10000, baseScore.uptime + Math.round(jitter * 0.5))),
      composite: Math.max(0, Math.min(10000, baseScore.composite + Math.round(jitter * 0.7))),
    }
  })
}

type RawScore = { accuracy: bigint; timeliness: bigint; uptime: bigint; composite: bigint; totalJobs: bigint; lastUpdated: bigint }

async function fetchAgentsFromChain(
  oracleAddress: `0x${string}`,
  chain: Parameters<typeof createPublicClient>[0]['chain'],
  rpcUrl: string,
): Promise<Array<{ address: string; score: ReputationScore }> | null> {
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout: 10000 }),
  })

  const [addrs, rawScores] = (await client.readContract({
    address: oracleAddress,
    abi: REPUTATION_ORACLE_ABI,
    functionName: 'getTopAgents',
    args: [50n],
  })) as [readonly `0x${string}`[], readonly RawScore[]]

  if (!addrs || addrs.length === 0) return null

  return addrs.map((addr, i) => ({
    address: addr,
    score: {
      accuracy: Number(rawScores[i].accuracy),
      timeliness: Number(rawScores[i].timeliness),
      uptime: Number(rawScores[i].uptime),
      composite: Number(rawScores[i].composite),
      totalJobs: Number(rawScores[i].totalJobs),
      lastUpdated: Number(rawScores[i].lastUpdated) * 1000,
    },
  }))
}

export async function GET(): Promise<Response> {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }

  // Try Sepolia first (all 25 seed workers were scored here), then 0G Galileo, then seed fallback.
  let agents: Array<{ address: string; score: ReputationScore }> | null = null

  try {
    agents = await fetchAgentsFromChain(
      SEPOLIA_ORACLE,
      sepolia,
      'https://ethereum-sepolia-rpc.publicnode.com',
    )
  } catch { /* fall through */ }

  if (!agents) {
    try {
      agents = await fetchAgentsFromChain(
        REPUTATION_ORACLE,
        zgGalileo,
        'https://evmrpc-testnet.0g.ai',
      )
    } catch { /* fall through */ }
  }

  const resolved = agents ?? MOCK_AGENTS
  const history: Record<string, ScorePoint[]> = {}
  for (const agent of resolved) history[agent.address] = generateHistory(agent.score, agent.address)

  return Response.json({ agents: resolved, history } satisfies ScoresResponse, { headers })
}
