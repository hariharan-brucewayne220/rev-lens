'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

interface Props {
  token: string
  email: string
  role: string
}

export function SignupForm({ token, email, role }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/invites/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to create account')
      setLoading(false)
      return
    }

    // Auto sign-in after account creation
    await signIn('credentials', { email, password, redirect: false })
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div className="bg-indigo-900/20 border border-indigo-800 rounded-lg px-3 py-2 text-sm text-indigo-300">
        Invited as <strong>{role}</strong> · {email}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Your name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Full name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="At least 8 characters"
        />
      </div>
      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
      >
        {loading ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  )
}
