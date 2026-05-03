// GET /api/activity — M-25
// Returns real ScoreUpdated events sourced from the Sepolia ReputationOracle tx hashes
// recorded in scripts/seed-output.json during the seed-scoring run.
import { NextRequest } from 'next/server'
import type { ActivityEvent } from '@agentnet/types'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface ScoreTx {
  address: string
  txHash: string
  blockNumber: number
}

interface SeedWorker {
  address: string
  profile: string
  accuracy: number
  timeliness: number
  uptime: number
  composite: number
  totalJobs: number
}

interface SeedData {
  seededAt?: string
  sepoliaScoreTxs?: ScoreTx[]
  workers?: SeedWorker[]
}

function loadSeedData(): SeedData {
  const seedPath = join(process.cwd(), '../../scripts/seed-output.json')
  if (!existsSync(seedPath)) return {}
  try {
    return JSON.parse(readFileSync(seedPath, 'utf8'))
  } catch {
    return {}
  }
}

const seed = loadSeedData()
const workerMap = new Map<string, SeedWorker>()
for (const w of seed.workers ?? []) workerMap.set(w.address.toLowerCase(), w)

// Derive timestamps: seededAt + ~12s per Sepolia block from the first scored block
const baseTs = seed.seededAt ? new Date(seed.seededAt).getTime() : Date.now() - 30 * 60 * 1000
const firstBlock = seed.sepoliaScoreTxs?.[0]?.blockNumber ?? 0

const SCORE_EVENTS: ActivityEvent[] = (seed.sepoliaScoreTxs ?? [])
  .map((tx) => {
    const w = workerMap.get(tx.address.toLowerCase())
    const blockDelta = tx.blockNumber - firstBlock
    const timestamp = baseTs + blockDelta * 12_000
    const summary = w
      ? `Reputation score written on-chain: composite ${w.composite} (acc ${w.accuracy} / tim ${w.timeliness} / upt ${w.uptime})`
      : `Reputation score updated on-chain for ${tx.address.slice(0, 10)}…`
    return {
      id: `score-${tx.txHash.slice(2, 12)}`,
      type: 'score' as const,
      summary,
      actors: [tx.address],
      timestamp,
      txHash: tx.txHash,
    }
  })
  .sort((a, b) => b.timestamp - a.timestamp)

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get('limit')
  const typeFilter = searchParams.get('type') as ActivityEvent['type'] | null

  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  }

  let events = SCORE_EVENTS

  if (typeFilter && ['task', 'payment', 'score'].includes(typeFilter)) {
    events = events.filter((e) => e.type === typeFilter)
  }

  return Response.json(events.slice(0, limit), { headers })
}
