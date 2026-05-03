// GET /api/storage — read task results from the in-process store.
// Mirrors the 0G Storage namespace pattern used by the worker agents.
//
// Query params:
//   namespace  — e.g. "wallet-summaries", "token-checks", "pool-index"
//   prefix     — optional key prefix filter (e.g. worker address)
import { NextRequest } from 'next/server'
import { listTasks } from '@/lib/task-store'

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const namespace = searchParams.get('namespace') ?? 'wallet-summaries'
  const prefix = searchParams.get('prefix') ?? undefined

  const entries = listTasks(namespace, prefix)

  return Response.json(entries, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
