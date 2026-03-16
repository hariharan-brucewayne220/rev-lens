import { createClient } from '@supabase/supabase-js'

const BUCKET = 'recordings'
const SIGNED_URL_TTL = 900

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL env var is not set')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY env var is not set')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function uploadRecording(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const supabase = getServiceClient()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return path
}

export async function getSignedUrl(path: string): Promise<string> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL)
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`)
  return data.signedUrl
}

export async function downloadRecording(path: string): Promise<Buffer> {
  const supabase = getServiceClient()
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) throw new Error(`Download failed: ${error?.message}`)
  return Buffer.from(await data.arrayBuffer())
}

export async function deleteRecording(path: string): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(`Delete failed: ${error.message}`)
}
