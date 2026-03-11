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
