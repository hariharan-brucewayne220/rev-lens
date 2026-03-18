'use client'
import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

type EntityType = 'account' | 'contact' | 'opportunity'

interface ErrorRow { row: number; error: string }
interface ImportResult {
  rowsTotal: number
  rowsSuccess: number
  rowsFailed: number
  errorRows: ErrorRow[]
  importId?: string
}

const ENTITY_LABELS: Record<EntityType, string> = {
  account: 'Accounts',
  contact: 'Contacts',
  opportunity: 'Opportunities',
}

const COLUMN_HINTS: Record<EntityType, string> = {
  account: 'crmId*, name*, industry, website',
  contact: 'accountCrmId*, name*, email, title, phone',
  opportunity: 'crmId*, name*, accountCrmId*, ownerEmail*, stage*, amount*, closeDate*, forecastCategory',
}

export function ImportForm() {
  const [entityType, setEntityType] = useState<EntityType>('account')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setResult(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('entityType', entityType)

    try {
      const res = await fetch('/api/crm/import', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Import failed')
      } else {
        setResult(data)
        if (fileRef.current) fileRef.current.value = ''
        setFile(null)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Entity type selector */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Entity Type</label>
          <div className="flex gap-2">
            {(Object.keys(ENTITY_LABELS) as EntityType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => { setEntityType(type); setResult(null); setError(null) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  entityType === type
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#1e2130] text-slate-400 hover:text-slate-200'
                }`}
              >
                {ENTITY_LABELS[type]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Required columns: <span className="text-slate-400 font-mono">{COLUMN_HINTS[entityType]}</span>
          </p>
        </div>

        {/* File input */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">CSV File</label>
          <div
            className="border-2 border-dashed border-[#2a2f45] rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3 text-slate-300">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <Upload className="w-8 h-8" />
                <p className="text-sm">Click to select a CSV file</p>
                <p className="text-xs">Max 10 MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium rounded-lg transition-colors text-sm"
        >
          {loading ? 'Importing…' : `Import ${ENTITY_LABELS[entityType]}`}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div className="bg-[#0f1117] border border-[#1e2130] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            {result.rowsFailed === 0 ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400" />
            )}
            <span className="text-sm font-medium text-slate-200">Import complete</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total" value={result.rowsTotal} />
            <Stat label="Imported" value={result.rowsSuccess} color="emerald" />
            <Stat label="Failed" value={result.rowsFailed} color={result.rowsFailed > 0 ? 'red' : undefined} />
          </div>

          {result.errorRows.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Row Errors</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.errorRows.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-red-400">
                    <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Row {e.row}: {e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: 'emerald' | 'red' }) {
  const textColor = color === 'emerald' ? 'text-emerald-400' : color === 'red' ? 'text-red-400' : 'text-slate-200'
  return (
    <div className="bg-[#1e2130] rounded-lg p-3 text-center">
      <p className={`text-xl font-bold ${textColor}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}
