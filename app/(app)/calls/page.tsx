import { getCalls, getOpportunities } from '@/lib/db'
import { getSession } from '@/lib/auth'
import type { UserScope } from '@/lib/types'
import { CallUpload } from '@/components/calls/call-upload'
import Link from 'next/link'
import { format } from 'date-fns'
import { Mic, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const STATUS_CONFIG = {
  pending:      { icon: Clock,       color: 'text-slate-400',   label: 'Pending' },
  transcribing: { icon: Loader2,     color: 'text-blue-400',    label: 'Transcribing' },
  analyzing:    { icon: Loader2,     color: 'text-indigo-400',  label: 'Analyzing' },
  done:         { icon: CheckCircle, color: 'text-emerald-400', label: 'Done' },
  failed:       { icon: AlertCircle, color: 'text-red-400',     label: 'Failed' },
} as const

export default async function CallsPage() {
  const user = (await getSession())!
  const scope: UserScope = { orgId: user.orgId, userId: user.id, role: user.role }

  const [calls, opps] = await Promise.all([
    getCalls(scope),
    getOpportunities(scope),
  ])

  const opportunities = opps.map((o) => ({ id: o.id, name: o.name }))

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl font-bold text-slate-100">Calls</h1>

      <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-5 max-w-lg">
        <h2 className="text-sm font-medium text-slate-200 mb-4">Upload Recording</h2>
        <CallUpload opportunities={opportunities} />
      </div>

      {calls.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Mic className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No calls yet. Upload your first recording above.</p>
        </div>
      ) : (
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2130]">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Recording</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Opportunity</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Duration</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => {
                const cfg = STATUS_CONFIG[call.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
                const Icon = cfg.icon
                return (
                  <tr key={call.id} className="border-b border-[#1e2130] last:border-0 hover:bg-[#1e2130]/50 transition-colors">
                    <td className="px-4 py-3">
                      {call.status === 'done' ? (
                        <Link href={`/calls/${call.id}`} className="text-indigo-400 hover:text-indigo-300 truncate max-w-[200px] block">
                          {call.summary ? call.summary.slice(0, 60) + '…' : call.audioPath.split('/').pop()}
                        </Link>
                      ) : (
                        <span className="text-slate-400 truncate max-w-[200px] block">
                          {call.audioPath.split('/').pop()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {call.opportunity?.name ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1.5 ${cfg.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-xs">{cfg.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {format(call.createdAt, 'MMM d, HH:mm')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
