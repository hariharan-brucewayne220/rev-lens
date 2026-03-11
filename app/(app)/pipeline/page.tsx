import { getOpportunities } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { KanbanBoard } from '@/components/pipeline/kanban-board'
import type { UserScope } from '@/lib/types'

export const STAGES = [
  'Prospecting',
  'Qualification',
  'Demo',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
]

export default async function PipelinePage() {
  const user = (await getSession())!  // layout guarantees non-null

  const scope: UserScope = { orgId: user.orgId, userId: user.id, role: user.role }
  const raw = await getOpportunities(scope)

  // Serialize Prisma Decimal and Date fields for client component
  const opportunities = raw.map((opp) => ({
    id: opp.id,
    name: opp.name,
    stage: opp.stage,
    amount: Number(opp.amount ?? 0),
    healthScore: opp.healthScore,
    closeDate: opp.closeDate.toISOString(),
    account: { name: opp.account.name },
  }))

  return (
    <div className="p-6 h-full flex flex-col min-h-0">
      <h1 className="text-xl font-bold text-slate-100 mb-6 flex-shrink-0">Pipeline</h1>
      <div className="flex-1 min-h-0">
        <KanbanBoard opportunities={opportunities} stages={STAGES} />
      </div>
    </div>
  )
}
