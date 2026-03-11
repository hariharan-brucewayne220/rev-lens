import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { updateOpportunityStage } from '@/lib/db'
import type { UserScope } from '@/lib/types'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireSession().catch(() => null)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stage } = await req.json()
  if (!stage) return NextResponse.json({ error: 'stage is required' }, { status: 400 })

  const scope: UserScope = { orgId: user.orgId, userId: user.id, role: user.role }

  try {
    const opp = await updateOpportunityStage(scope, params.id, stage)
    return NextResponse.json(opp)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'Not found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
