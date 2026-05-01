// GET /api/activity — M-25
import { NextRequest } from 'next/server'
import type { ActivityEvent } from '@agentnet/types'

const ADDRESSES = [
  '0xFBEd89164eD414729D180948c05EBa60E56a803d',
  '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  '0x742d35Cc6634C0532925a3b8D4C9a8B1D6f3E7A',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
]

function mockTxHash(seed: number): string {
  const hex = (seed * 0xdeadbeef).toString(16).padStart(8, '0')
  return `0x${hex}${'0'.repeat(56)}`
}

const now = Date.now()
const twoHoursMs = 2 * 60 * 60 * 1000

const ALL_EVENTS: ActivityEvent[] = [
  {
    id: 'evt-001',
    type: 'task',
    summary: 'Completed pool-indexer task: Indexed Uniswap v3 WETH/USDC pool',
    actors: [ADDRESSES[0], ADDRESSES[3]],
    timestamp: now - 120000,
    txHash: mockTxHash(1),
  },
  {
    id: 'evt-002',
    type: 'payment',
    summary: 'Payment received: 0.01 OG for pool indexing task',
    actors: [ADDRESSES[3], ADDRESSES[0]],
    timestamp: now - 180000,
    txHash: mockTxHash(2),
  },
  {
    id: 'evt-003',
    type: 'score',
    summary: 'Reputation score updated: composite 9185 (+12 from last update)',
    actors: [ADDRESSES[0]],
    timestamp: now - 240000,
  },
  {
    id: 'evt-004',
    type: 'task',
    summary: 'Completed token-fact-checker task: Verified SHIB token metadata',
    actors: [ADDRESSES[1], ADDRESSES[4]],
    timestamp: now - 360000,
    txHash: mockTxHash(4),
  },
  {
    id: 'evt-005',
    type: 'payment',
    summary: 'Payment received: 0.005 OG for token fact-checking task',
    actors: [ADDRESSES[4], ADDRESSES[1]],
    timestamp: now - 420000,
    txHash: mockTxHash(5),
  },
  {
    id: 'evt-006',
    type: 'task',
    summary: 'Completed wallet-summarizer task: Summarized 0x3C44...3BC activity',
    actors: [ADDRESSES[2], ADDRESSES[3]],
    timestamp: now - 540000,
    txHash: mockTxHash(6),
  },
  {
    id: 'evt-007',
    type: 'score',
    summary: 'Reputation score updated: composite 7490 (-8 from last update)',
    actors: [ADDRESSES[1]],
    timestamp: now - 600000,
  },
  {
    id: 'evt-008',
    type: 'task',
    summary: 'Completed pool-indexer task: Indexed Curve 3pool liquidity snapshot',
    actors: [ADDRESSES[1], ADDRESSES[4]],
    timestamp: now - 660000,
    txHash: mockTxHash(8),
  },
  {
    id: 'evt-009',
    type: 'payment',
    summary: 'Payment received: 0.005 OG for pool indexing task',
    actors: [ADDRESSES[4], ADDRESSES[1]],
    timestamp: now - 720000,
    txHash: mockTxHash(9),
  },
  {
    id: 'evt-010',
    type: 'task',
    summary: 'Completed wallet-summarizer task: Analyzed DeFi portfolio for 0x90F7...906',
    actors: [ADDRESSES[0], ADDRESSES[4]],
    timestamp: now - 840000,
    txHash: mockTxHash(10),
  },
  {
    id: 'evt-011',
    type: 'payment',
    summary: 'Payment received: 0.01 OG for wallet summarizer task',
    actors: [ADDRESSES[4], ADDRESSES[0]],
    timestamp: now - 900000,
    txHash: mockTxHash(11),
  },
  {
    id: 'evt-012',
    type: 'score',
    summary: 'Reputation score updated: composite 4920 (+35 from last update)',
    actors: [ADDRESSES[2]],
    timestamp: now - 960000,
  },
  {
    id: 'evt-013',
    type: 'task',
    summary: 'Completed token-fact-checker task: Verified PEPE token contract legitimacy',
    actors: [ADDRESSES[1], ADDRESSES[3]],
    timestamp: now - 1080000,
    txHash: mockTxHash(13),
  },
  {
    id: 'evt-014',
    type: 'payment',
    summary: 'Payment received: 0.005 OG for token fact-checking task',
    actors: [ADDRESSES[3], ADDRESSES[1]],
    timestamp: now - 1140000,
    txHash: mockTxHash(14),
  },
  {
    id: 'evt-015',
    type: 'task',
    summary: 'Completed pool-indexer task: Indexed Balancer weighted pool state',
    actors: [ADDRESSES[0], ADDRESSES[4]],
    timestamp: now - 1260000,
    txHash: mockTxHash(15),
  },
  {
    id: 'evt-016',
    type: 'score',
    summary: 'Reputation score updated: composite 9185 (+3 from last update)',
    actors: [ADDRESSES[0]],
    timestamp: now - 1320000,
  },
  {
    id: 'evt-017',
    type: 'task',
    summary: 'Completed wallet-summarizer task: Generated risk report for 0x3C44...3BC',
    actors: [ADDRESSES[2], ADDRESSES[3]],
    timestamp: now - 1440000,
    txHash: mockTxHash(17),
  },
  {
    id: 'evt-018',
    type: 'payment',
    summary: 'Payment received: 0.003 OG for wallet summarizer task',
    actors: [ADDRESSES[3], ADDRESSES[2]],
    timestamp: now - 1500000,
    txHash: mockTxHash(18),
  },
  {
    id: 'evt-019',
    type: 'task',
    summary: 'Completed pool-indexer task: Captured Aave v3 lending pool snapshot',
    actors: [ADDRESSES[1], ADDRESSES[4]],
    timestamp: now - 1620000,
    txHash: mockTxHash(19),
  },
  {
    id: 'evt-020',
    type: 'payment',
    summary: 'Payment received: 0.005 OG for pool indexing task',
    actors: [ADDRESSES[4], ADDRESSES[1]],
    timestamp: now - twoHoursMs + 60000,
    txHash: mockTxHash(20),
  },
]

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get('limit')
  const typeFilter = searchParams.get('type') as ActivityEvent['type'] | null

  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  }

  let events = [...ALL_EVENTS]

  if (typeFilter && ['task', 'payment', 'score'].includes(typeFilter)) {
    events = events.filter((e) => e.type === typeFilter)
  }

  events = events.slice(0, limit)

  return Response.json(events, { headers })
}
