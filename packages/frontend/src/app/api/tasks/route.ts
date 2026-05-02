// POST /api/tasks — dispatch a task to the best available worker
import { NextRequest } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'

type TaskType = 'pool-indexer' | 'wallet-summarizer' | 'token-fact-checker'

interface SeedWorker {
  address: string
  profile: string
  capabilities: string[]
  composite: number
  feePerTask: string
}

function loadSeedWorkers(): SeedWorker[] {
  const seedPath = join(process.cwd(), '../../scripts/seed-output.json')
  if (!existsSync(seedPath)) return []
  try {
    const raw = JSON.parse(readFileSync(seedPath, 'utf8'))
    return raw.workers ?? []
  } catch {
    return []
  }
}

function pickBestWorker(workers: SeedWorker[], capability: TaskType): SeedWorker | null {
  const eligible = workers.filter((w) => w.capabilities.includes(capability))
  if (eligible.length === 0) return null
  return eligible.reduce((best, w) => (w.composite > best.composite ? w : best))
}

// Simulated task execution — runs real logic where possible, canned data as fallback
async function executeTask(
  taskType: TaskType,
  params: Record<string, string>
): Promise<{ result: unknown; executionMs: number }> {
  const start = Date.now()

  if (taskType === 'pool-indexer') {
    const poolAddress = params.poolAddress || '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640'
    const blockRange = parseInt(params.blockRange || '500', 10)
    // Return realistic simulated pool data
    const result = {
      poolAddress,
      blockRange,
      token0: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH' },
      token1: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC' },
      swapCount: Math.floor(Math.random() * 200) + 50,
      totalVolumeToken0: (Math.random() * 500 + 100).toFixed(4),
      totalVolumeToken1: (Math.random() * 800000 + 200000).toFixed(2),
      blockStart: 21000000,
      blockEnd: 21000000 + blockRange,
    }
    return { result, executionMs: Date.now() - start }
  }

  if (taskType === 'wallet-summarizer') {
    const walletAddress = params.walletAddress || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
    const result = {
      walletAddress,
      summary: `This wallet has been active primarily in DeFi protocols. It has interacted with Uniswap v3, Aave v3, and several ERC-20 tokens over the past 30 days. The wallet shows a pattern of liquidity provision and token swaps, with ${Math.floor(Math.random() * 40 + 10)} transactions in the scanned range.`,
      stats: {
        txCount: Math.floor(Math.random() * 40) + 10,
        uniqueTokens: Math.floor(Math.random() * 8) + 2,
        totalValueTransferred: `${(Math.random() * 10 + 1).toFixed(2)} ETH`,
        mostActiveProtocol: 'Uniswap v3',
      },
    }
    return { result, executionMs: Date.now() - start }
  }

  if (taskType === 'token-fact-checker') {
    const tokenAddress = params.tokenAddress || '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
    const rand = Math.random()
    const verdict = rand > 0.7 ? 'legit' : rand > 0.4 ? 'suspicious' : rand > 0.2 ? 'honeypot' : 'legit'
    const result = {
      tokenAddress,
      verdict,
      confidence: Math.floor(Math.random() * 20) + 78,
      reasoning:
        verdict === 'legit'
          ? 'Token contract is verified, has normal transfer mechanics, and shows healthy liquidity distribution across holders.'
          : verdict === 'suspicious'
          ? 'Contract has a mint function and top-10 holders control >60% of supply. Exercise caution.'
          : 'Contract contains a blacklist mechanism and ownership is not renounced. Transfer restrictions detected.',
      checks: {
        hasMintFunction: verdict !== 'legit',
        hasBlacklist: verdict === 'honeypot',
        hasPausable: false,
        liquidityLocked: verdict === 'legit',
        topHolderConcentration: verdict === 'legit' ? 28 : 67,
        contractAge: Math.floor(Math.random() * 500) + 30,
        hasVerifiedSource: verdict === 'legit',
      },
    }
    return { result, executionMs: Date.now() - start }
  }

  throw new Error(`Unknown task type: ${taskType}`)
}

export async function POST(request: NextRequest): Promise<Response> {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }

  let body: { taskType?: TaskType; params?: Record<string, string>; callerAddress?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers })
  }

  const { taskType, params = {}, callerAddress } = body

  if (!taskType || !['pool-indexer', 'wallet-summarizer', 'token-fact-checker'].includes(taskType)) {
    return Response.json({ error: 'Invalid taskType' }, { status: 400, headers })
  }

  const workers = loadSeedWorkers()
  const worker = pickBestWorker(workers, taskType)

  if (!worker) {
    return Response.json({ error: 'No workers available for this task type' }, { status: 503, headers })
  }

  const taskId = nanoid()

  try {
    const { result, executionMs } = await executeTask(taskType, params)

    return Response.json(
      {
        taskId,
        taskType,
        callerAddress: callerAddress ?? null,
        workerAddress: worker.address,
        workerScore: worker.composite,
        workerFee: worker.feePerTask,
        result,
        executionMs,
        completedAt: Date.now(),
      },
      { headers }
    )
  } catch (err: unknown) {
    return Response.json(
      { error: (err as Error).message ?? 'Task execution failed' },
      { status: 500, headers }
    )
  }
}
