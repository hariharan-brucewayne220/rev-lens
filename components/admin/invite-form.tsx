'use client'
import { useState } from 'react'
import { CheckCircle, AlertCircle } from 'lucide-react'

type Role = 'admin' | 'manager' | 'rep'

export function InviteForm() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('rep')
  const [loading, setLoading] = useState(false)
  const [signupUrl, setSignupUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSignupUrl(null)

    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Failed to create invite')
    } else {
      setSignupUrl(data.signupUrl)
      setEmail('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="colleague@company.com"
        className="w-full px-3 py-2 bg-[#1e2130] border border-[#2a2f45] rounded-lg text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="flex gap-2">
        {(['rep', 'manager', 'admin'] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              role === r ? 'bg-indigo-600 text-white' : 'bg-[#1e2130] text-slate-400 hover:text-slate-200'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={loading || !email}
        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {loading ? 'Sending…' : 'Send Invite'}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </div>
      )}
      {signupUrl && (
        <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" /> Invite created
          </div>
          <p className="text-xs text-slate-400 break-all font-mono">{signupUrl}</p>
        </div>
      )}
    </form>
  )
}
