import { getCall } from '@/lib/db'
import { getSession } from '@/lib/auth'
import type { UserScope } from '@/lib/types'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { CheckCircle, AlertTriangle, Zap, ClipboardList, Brain, MessageSquare } from 'lucide-react'

interface Segment { speaker: string; text: string; startMs: number }
interface Objection { id: string; text: string; category: string }
interface CompetitorMention { id: string; competitorName: string; context: string }
interface BuyingSignal { id: string; text: string; signalType: string }
interface ActionItem { id: string; text: string; assignedToRole: string; done: boolean }
interface Risk { id: string; type: string; severity: string; description: string }
interface CoachingInsight { id: string; content: string; category: string }

function msToTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-900/30 text-red-400 border-red-800/50',
  high: 'bg-orange-900/30 text-orange-400 border-orange-800/50',
  medium: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
  low: 'bg-slate-800 text-slate-400 border-slate-700',
}

export default async function CallDetailPage({ params }: { params: { id: string } }) {
  const user = (await getSession())!
  const scope: UserScope = { orgId: user.orgId, userId: user.id, role: user.role }
  const call = await getCall(scope, params.id)
  if (!call) notFound()

  const segments = (call.transcript?.segments as unknown as Segment[]) ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs text-slate-500 mb-1">{format(call.createdAt, 'MMMM d, yyyy · HH:mm')}</p>
        <h1 className="text-xl font-bold text-slate-100">
          {call.summary ? call.summary.slice(0, 80) : 'Call Recording'}
        </h1>
        {call.opportunity && (
          <p className="text-sm text-slate-400 mt-1">↗ {(call.opportunity as { name: string }).name}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Transcript */}
        <div className="lg:col-span-2 space-y-6">
          {segments.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Transcript
              </h2>
              <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-5 space-y-3 max-h-96 overflow-y-auto">
                {segments.map((seg, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-xs text-slate-600 w-10 shrink-0 mt-0.5 font-mono">
                      {msToTime(seg.startMs)}
                    </span>
                    <div>
                      <span className="text-xs font-medium text-indigo-400 capitalize">{seg.speaker}</span>
                      <p className="text-sm text-slate-300 mt-0.5 leading-relaxed">{seg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Objections */}
          {(call.objections as Objection[]).length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Objections
              </h2>
              <div className="space-y-2">
                {(call.objections as Objection[]).map((o) => (
                  <div key={o.id} className="bg-[#0f1117] border border-[#1e2130] rounded-lg px-4 py-3 flex items-start gap-3">
                    <span className="text-xs bg-amber-900/30 text-amber-400 border border-amber-800/50 rounded-full px-2 py-0.5 capitalize shrink-0">
                      {o.category}
                    </span>
                    <p className="text-sm text-slate-300">{o.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Action Items */}
          {(call.actionItems as ActionItem[]).length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-400" /> Action Items
              </h2>
              <div className="space-y-2">
                {(call.actionItems as ActionItem[]).map((a) => (
                  <div key={a.id} className="bg-[#0f1117] border border-[#1e2130] rounded-lg px-4 py-3 flex items-start gap-3">
                    <span className="text-xs bg-blue-900/30 text-blue-400 border border-blue-800/50 rounded-full px-2 py-0.5 capitalize shrink-0">
                      {a.assignedToRole}
                    </span>
                    <p className="text-sm text-slate-300">{a.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right: Signals, Risks, Coaching */}
        <div className="space-y-6">
          {(call.buyingSignals as BuyingSignal[]).length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" /> Buying Signals
              </h2>
              <div className="space-y-2">
                {(call.buyingSignals as BuyingSignal[]).map((b) => (
                  <div key={b.id} className="bg-emerald-900/10 border border-emerald-800/30 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-400 capitalize mb-0.5">{b.signalType}</p>
                    <p className="text-sm text-slate-300">{b.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(call.risks as Risk[]).length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Risks
              </h2>
              <div className="space-y-2">
                {(call.risks as Risk[]).map((r) => (
                  <div key={r.id} className="bg-[#0f1117] border border-[#1e2130] rounded-lg px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${SEVERITY_STYLES[r.severity] ?? SEVERITY_STYLES.low}`}>
                        {r.severity}
                      </span>
                      <span className="text-xs text-slate-500">{r.type}</span>
                    </div>
                    <p className="text-xs text-slate-400">{r.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(call.coachingInsights as CoachingInsight[]).length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-violet-400" /> Coaching
              </h2>
              <div className="space-y-2">
                {(call.coachingInsights as CoachingInsight[]).map((c) => (
                  <div key={c.id} className="bg-violet-900/10 border border-violet-800/30 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500 capitalize mb-0.5">{c.category.replace('_', ' ')}</p>
                    <p className="text-xs text-slate-300">{c.content}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(call.competitorMentions as CompetitorMention[]).length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Competitors
              </h2>
              <div className="space-y-2">
                {(call.competitorMentions as CompetitorMention[]).map((c) => (
                  <div key={c.id} className="bg-[#0f1117] border border-[#1e2130] rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-slate-200">{c.competitorName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{c.context}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {call.status !== 'done' && (
            <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-4 text-center text-xs text-slate-500">
              <CheckCircle className="w-6 h-6 mx-auto mb-2 opacity-30" />
              Analysis {call.status === 'failed' ? 'failed' : 'in progress'}…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
