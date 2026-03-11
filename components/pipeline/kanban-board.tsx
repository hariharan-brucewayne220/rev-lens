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
