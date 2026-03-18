import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { ImportForm } from '@/components/crm/import-form'
import { InviteForm } from '@/components/admin/invite-form'
import { UserList } from '@/components/admin/user-list'
import { OpenAIKeyForm } from '@/components/admin/openai-key-form'
import { format } from 'date-fns'

export default async function AdminPage() {
  const user = (await getSession())!
  if (user.role !== 'admin') redirect('/dashboard')

  const [users, pendingInvites, importHistory] = await Promise.all([
    prisma.user.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.invite.findMany({
      where: { orgId: user.orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.cRMImport.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-10">
      <h1 className="text-xl font-bold text-slate-100">Admin</h1>

      {/* Team Management */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Team</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-200 mb-4">Invite Member</h3>
            <InviteForm />
          </div>
          <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-200 mb-4">
              Members <span className="text-slate-500 font-normal">({users.length})</span>
            </h3>
            <UserList users={users} currentUserId={user.id} />
          </div>
        </div>

        {pendingInvites.length > 0 && (
          <div className="mt-4 bg-[#0f1117] border border-[#1e2130] rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-200 mb-3">
              Pending Invites <span className="text-slate-500 font-normal">({pendingInvites.length})</span>
            </h3>
            <div className="space-y-2">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{inv.email}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 capitalize">{inv.role}</span>
                    <span className="text-xs text-amber-400">
                      expires {format(inv.expiresAt, 'MMM d')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* CRM Import */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">CRM Import</h2>
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-5">
          <ImportForm />
        </div>

        {importHistory.length > 0 && (
          <div className="mt-4 bg-[#0f1117] border border-[#1e2130] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2130]">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">File</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Rows</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Failed</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map((imp) => (
                  <tr key={imp.id} className="border-b border-[#1e2130] last:border-0">
                    <td className="px-4 py-3 text-slate-300 max-w-[160px] truncate">{imp.fileName}</td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{imp.entityType}</td>
                    <td className="px-4 py-3 text-slate-300 text-right">{imp.rowsSuccess}/{imp.rowsTotal}</td>
                    <td className="px-4 py-3 text-right">
                      {imp.rowsFailed > 0 ? (
                        <span className="text-red-400">{imp.rowsFailed}</span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={imp.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {format(imp.createdAt, 'MMM d, HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* OpenAI Key */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          AI Configuration
        </h2>
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-200 mb-1">OpenAI API Key</h3>
          <p className="text-xs text-slate-500 mb-4">
            Used for call transcription and analysis. Stored encrypted.
          </p>
          <OpenAIKeyForm />
        </div>
      </section>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    done: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50',
    processing: 'bg-blue-900/30 text-blue-400 border-blue-800/50',
    failed: 'bg-red-900/30 text-red-400 border-red-800/50',
  }[status] ?? 'bg-slate-800 text-slate-400 border-slate-700'

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${styles}`}>
      {status}
    </span>
  )
}
