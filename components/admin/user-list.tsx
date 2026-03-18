const ROLE_STYLES = {
  admin: 'bg-violet-900/30 text-violet-400 border-violet-800/50',
  manager: 'bg-blue-900/30 text-blue-400 border-blue-800/50',
  rep: 'bg-slate-800 text-slate-400 border-slate-700',
}

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'rep'
  createdAt: Date
}

export function UserList({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-slate-200 truncate">
              {u.name}
              {u.id === currentUserId && (
                <span className="ml-1.5 text-xs text-slate-500">(you)</span>
              )}
            </p>
            <p className="text-xs text-slate-500 truncate">{u.email}</p>
          </div>
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${ROLE_STYLES[u.role]}`}
          >
            {u.role}
          </span>
        </div>
      ))}
    </div>
  )
}
