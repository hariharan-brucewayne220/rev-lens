# RevLens Chunk 3: Core Pages Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Dashboard and Pipeline pages, and stub out all remaining nav routes so the sidebar navigation is fully functional.

**Architecture:** Server Components fetch data using existing `lib/db.ts` helpers and pass serialized props to Client Components. The Pipeline Kanban uses `@hello-pangea/dnd` for drag-and-drop. Stage updates go through a PATCH API route that enforces org scoping via `lib/db.ts`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, @hello-pangea/dnd, Prisma (via lib/db.ts helpers)

---

## Chunk 3: Core Pages

### Task 12: Stub Pages for All Nav Routes

**Files:**
- Create: `app/(app)/accounts/page.tsx`
- Create: `app/(app)/calls/page.tsx`
- Create: `app/(app)/forecast/page.tsx`
- Create: `app/(app)/renewals/page.tsx`
- Create: `app/(app)/team/page.tsx`
- Create: `app/(app)/admin/page.tsx`

These stub pages make every sidebar nav item work (no more 404s). They will be replaced with full implementations in future chunks.

- [ ] **Step 1: Create stub pages**

```tsx
// app/(app)/accounts/page.tsx
export default function AccountsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-2">Accounts</h1>
      <p className="text-slate-400 text-sm">Coming soon.</p>
    </div>
  )
}
```

```tsx
// app/(app)/calls/page.tsx
export default function CallsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-2">Calls</h1>
      <p className="text-slate-400 text-sm">Coming soon.</p>
    </div>
  )
}
```

```tsx
// app/(app)/forecast/page.tsx
export default function ForecastPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-2">Forecast</h1>
      <p className="text-slate-400 text-sm">Coming soon.</p>
    </div>
  )
}
```

```tsx
// app/(app)/renewals/page.tsx
export default function RenewalsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-2">Renewals</h1>
      <p className="text-slate-400 text-sm">Coming soon.</p>
    </div>
  )
}
```

```tsx
// app/(app)/team/page.tsx
export default function TeamPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-2">Team</h1>
      <p className="text-slate-400 text-sm">Coming soon.</p>
    </div>
  )
}
```

```tsx
// app/(app)/admin/page.tsx
export default function AdminPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-2">Admin</h1>
      <p className="text-slate-400 text-sm">Coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/accounts app/\(app\)/calls app/\(app\)/forecast app/\(app\)/renewals app/\(app\)/team app/\(app\)/admin
git commit -m "feat: add stub pages for all nav routes"
```

---

### Task 13: Dashboard Page

**Files:**
- Create: `app/(app)/dashboard/page.tsx`

The dashboard shows 4 stat cards (pipeline value, open deals, call count, at-risk count) and a table of at-risk opportunities. Uses `getDashboardStats` and `getRiskyOpportunities` from `lib/db.ts`.

> **Note:** `Opportunity.amount` is a Prisma `Decimal` type — convert to `Number()` before rendering to avoid serialization issues with client-side formatting.

> **Note:** The `app/(app)/layout.tsx` already guards auth, so no redirect needed in the page. Call `getSession()` only to get the user for scope construction — no null-guard redirect.

- [ ] **Step 1: Create the dashboard page**

```tsx
// app/(app)/dashboard/page.tsx
import { getDashboardStats, getRiskyOpportunities } from '@/lib/db'
import { getSession } from '@/lib/auth'
import type { UserScope } from '@/lib/types'

export default async function DashboardPage() {
  const user = (await getSession())!  // layout guarantees non-null

  const scope: UserScope = { orgId: user.orgId, userId: user.id, role: user.role }

  const [stats, atRisk] = await Promise.all([
    getDashboardStats(scope),
    getRiskyOpportunities(scope),
  ])

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Pipeline Value" value={`$${Number(stats.pipelineValue).toLocaleString()}`} />
        <StatCard label="Open Deals" value={String(stats.openDeals)} />
        <StatCard label="Total Calls" value={String(stats.callCount)} />
        <StatCard
          label="At-Risk Deals"
          value={String(stats.atRiskCount)}
          highlight={stats.atRiskCount > 0}
        />
      </div>

      {atRisk.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            At-Risk Deals
          </h2>
          <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2130]">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Deal</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Account</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Stage</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.map((opp) => (
                  <tr
                    key={opp.id}
                    className="border-b border-[#1e2130] last:border-0 hover:bg-[#1e2130]/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-200 font-medium">{opp.name}</td>
                    <td className="px-4 py-3 text-slate-400">{opp.account.name}</td>
                    <td className="px-4 py-3 text-slate-400">{opp.stage}</td>
                    <td className="px-4 py-3 text-slate-200 text-right">
                      ${Number(opp.amount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {opp.risks[0] && (
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full border ${
                            opp.risks[0].severity === 'critical'
                              ? 'bg-red-900/30 text-red-400 border-red-800/50'
                              : opp.risks[0].severity === 'high'
                              ? 'bg-orange-900/30 text-orange-400 border-orange-800/50'
                              : 'bg-amber-900/30 text-amber-400 border-amber-800/50'
                          }`}
                        >
                          {opp.risks[0].severity}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">✓</p>
          <p className="text-sm">No at-risk deals. Pipeline looks healthy.</p>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-red-400' : 'text-slate-100'}`}>
        {value}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/dashboard
git commit -m "feat: add dashboard page with stats and at-risk deals table"
```

---

### Task 14: Stage Update API

**Files:**
- Create: `app/api/opportunities/[id]/stage/route.ts`
- Create: `tests/api/opportunities-stage.test.ts`

The Pipeline Kanban calls this endpoint when a deal is dragged to a new column. It uses `updateOpportunityStage` from `lib/db.ts` which already enforces org scoping.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/opportunities-stage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock lib/auth and lib/db
vi.mock('@/lib/auth', () => ({
  requireSession: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  updateOpportunityStage: vi.fn(),
}))

import { requireSession } from '@/lib/auth'
import { updateOpportunityStage } from '@/lib/db'
import { PATCH } from '@/app/api/opportunities/[id]/stage/route'

const mockUser = { id: 'u1', orgId: 'org1', role: 'admin' as const, email: 'a@b.com', name: 'A' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/opportunities/[id]/stage', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireSession).mockRejectedValue(new Error('Unauthorized'))
    const req = new NextRequest('http://localhost/api/opportunities/opp1/stage', {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'Demo' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: { id: 'opp1' } })
    expect(res.status).toBe(401)
  })

  it('returns 400 when stage is missing', async () => {
    vi.mocked(requireSession).mockResolvedValue(mockUser)
    const req = new NextRequest('http://localhost/api/opportunities/opp1/stage', {
      method: 'PATCH',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: { id: 'opp1' } })
    expect(res.status).toBe(400)
  })

  it('updates stage and returns 200 on success', async () => {
    vi.mocked(requireSession).mockResolvedValue(mockUser)
    vi.mocked(updateOpportunityStage).mockResolvedValue({ id: 'opp1', stage: 'Demo' } as never)
    const req = new NextRequest('http://localhost/api/opportunities/opp1/stage', {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'Demo' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: { id: 'opp1' } })
    expect(res.status).toBe(200)
    expect(updateOpportunityStage).toHaveBeenCalledWith(
      { orgId: 'org1', userId: 'u1', role: 'admin' },
      'opp1',
      'Demo'
    )
  })

  it('returns 404 when opportunity not found', async () => {
    vi.mocked(requireSession).mockResolvedValue(mockUser)
    vi.mocked(updateOpportunityStage).mockRejectedValue(new Error('Not found'))
    const req = new NextRequest('http://localhost/api/opportunities/opp1/stage', {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'Demo' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: { id: 'opp1' } })
    expect(res.status).toBe(404)
  })

  it('returns 500 for unexpected errors', async () => {
    vi.mocked(requireSession).mockResolvedValue(mockUser)
    vi.mocked(updateOpportunityStage).mockRejectedValue(new Error('DB connection failed'))
    const req = new NextRequest('http://localhost/api/opportunities/opp1/stage', {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'Demo' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: { id: 'opp1' } })
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/api/opportunities-stage.test.ts
```

Expected: FAIL — module not found (route doesn't exist yet)

- [ ] **Step 3: Create the route**

```typescript
// app/api/opportunities/[id]/stage/route.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/api/opportunities-stage.test.ts
```

Expected: 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add app/api/opportunities tests/api/opportunities-stage.test.ts
git commit -m "feat: add stage update API for pipeline kanban"
```

---

### Task 15: Pipeline Kanban Board

**Files:**
- Create: `app/(app)/pipeline/page.tsx`
- Create: `components/pipeline/kanban-board.tsx`

The pipeline page fetches all opportunities server-side, serializes Decimal/Date fields, and passes them to the `KanbanBoard` client component. The board groups deals by stage and supports drag-and-drop to update stage via the API from Task 14.

> **Important:** `Opportunity.amount` is a Prisma `Decimal` — must be converted to `number` before passing as props to the client component (Decimal is not JSON-serializable in Next.js).

- [ ] **Step 1: Create the Kanban board client component**

```tsx
// components/pipeline/kanban-board.tsx
'use client'
import { useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { cn } from '@/lib/utils'

export type SerializedOpportunity = {
  id: string
  name: string
  stage: string
  amount: number
  healthScore: number | null
  closeDate: string
  account: { name: string }
}

interface Props {
  opportunities: SerializedOpportunity[]
  stages: string[]
}

export function KanbanBoard({ opportunities: initial, stages }: Props) {
  const [opportunities, setOpportunities] = useState(initial)

  function getByStage(stage: string) {
    return opportunities.filter((o) => o.stage === stage)
  }

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result
    if (!destination || destination.droppableId === source.droppableId) return

    const newStage = destination.droppableId

    // Capture current state before optimistic update so we can revert accurately
    setOpportunities((prev) => {
      const snapshot = prev
      const next = prev.map((o) => (o.id === draggableId ? { ...o, stage: newStage } : o))

      fetch(`/api/opportunities/${draggableId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      }).catch(() => {
        // Revert to state just before this drag (not stale initial prop)
        setOpportunities(snapshot)
      })

      return next
    })
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 h-full overflow-x-auto pb-4">
        {stages.map((stage) => {
          const deals = getByStage(stage)
          const stageValue = deals.reduce((sum, d) => sum + d.amount, 0)

          return (
            <div key={stage} className="flex-shrink-0 w-60 flex flex-col">
              <div className="mb-2 px-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {stage}
                  </span>
                  <span className="text-xs text-slate-500">{deals.length}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">${stageValue.toLocaleString()}</p>
              </div>

              <Droppable droppableId={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 rounded-xl p-2 space-y-2 min-h-[120px] transition-colors',
                      snapshot.isDraggingOver ? 'bg-indigo-900/20 border border-indigo-800/40' : 'bg-[#0f1117]'
                    )}
                  >
                    {deals.map((deal, index) => (
                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn(
                              'bg-[#1e2130] border border-[#2a2f45] rounded-lg p-3 cursor-grab active:cursor-grabbing transition-shadow select-none',
                              snapshot.isDragging && 'shadow-xl shadow-black/50 rotate-1'
                            )}
                          >
                            <p className="text-sm font-medium text-slate-200 mb-1 leading-tight">
                              {deal.name}
                            </p>
                            <p className="text-xs text-slate-500 mb-2">{deal.account.name}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-300">
                                ${deal.amount.toLocaleString()}
                              </span>
                              {deal.healthScore !== null && (
                                <span
                                  className={cn(
                                    'text-xs font-medium px-1.5 py-0.5 rounded',
                                    deal.healthScore >= 70
                                      ? 'bg-green-900/40 text-green-400'
                                      : deal.healthScore >= 40
                                      ? 'bg-amber-900/40 text-amber-400'
                                      : 'bg-red-900/40 text-red-400'
                                  )}
                                >
                                  {deal.healthScore}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}
```

- [ ] **Step 2: Create the pipeline server page**

```tsx
// app/(app)/pipeline/page.tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/pipeline components/pipeline
git commit -m "feat: add pipeline kanban with drag-and-drop stage updates"
```
