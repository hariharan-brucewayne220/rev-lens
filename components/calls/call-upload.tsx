'use client'
import { useState, useRef } from 'react'
import { Upload, Mic, CheckCircle, AlertCircle } from 'lucide-react'

interface Opportunity { id: string; name: string }

export function CallUpload({ opportunities }: { opportunities: Opportunity[] }) {
  const [file, setFile] = useState<File | null>(null)
  const [opportunityId, setOpportunityId] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
    setDone(false)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)

    const fd = new FormData()
    fd.append('file', file)
    if (opportunityId) fd.append('opportunityId', opportunityId)

    try {
      const res = await fetch('/api/calls/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Upload failed')
      } else {
        setDone(true)
        setFile(null)
        setOpportunityId('')
        if (fileRef.current) fileRef.current.value = ''
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        className="border-2 border-dashed border-[#2a2f45] rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500/50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {file ? (
          <div className="flex items-center justify-center gap-2 text-slate-300 text-sm">
            <Mic className="w-4 h-4 text-indigo-400" />
            {file.name}
            <span className="text-slate-500 text-xs">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Upload className="w-7 h-7" />
            <p className="text-sm">Upload call recording</p>
            <p className="text-xs">mp3, mp4, m4a, wav, webm · max 25 MB</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".mp3,.mp4,.m4a,.wav,.webm" className="hidden" onChange={handleFile} />
      </div>

      {opportunities.length > 0 && (
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Link to opportunity (optional)</label>
          <select
            value={opportunityId}
            onChange={(e) => setOpportunityId(e.target.value)}
            className="w-full px-3 py-2 bg-[#1e2130] border border-[#2a2f45] rounded-lg text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">— none —</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {done && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-800/50 rounded-lg px-3 py-2">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          Uploaded — AI analysis in progress. Refresh in a minute.
        </div>
      )}

      <button
        type="submit"
        disabled={!file || loading}
        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {loading ? 'Uploading…' : 'Upload & Analyze'}
      </button>
    </form>
  )
}
