'use client'
import { useState } from 'react'
import { CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'

export function OpenAIKeyForm() {
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)

    const res = await fetch('/api/admin/openai-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Failed to save key')
    } else {
      setSaved(true)
      setKey('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <input
          type={show ? 'text' : 'password'}
          value={key}
          onChange={(e) => { setKey(e.target.value); setSaved(false); setError(null) }}
          placeholder="sk-..."
          required
          className="w-full pr-10 px-3 py-2 bg-[#1e2130] border border-[#2a2f45] rounded-lg text-slate-200 placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <button
        type="submit"
        disabled={loading || !key}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
      >
        {loading ? 'Saving…' : 'Save Key'}
      </button>
      {saved && <CheckCircle className="w-5 h-5 text-emerald-400 self-center shrink-0" />}
      {error && (
        <div title={error}>
          <AlertCircle className="w-5 h-5 text-red-400 self-center shrink-0" />
        </div>
      )}
    </form>
  )
}
