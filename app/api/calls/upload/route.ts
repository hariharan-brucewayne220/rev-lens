import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { uploadRecording } from '@/lib/storage'
import { inngest } from '@/inngest/client'
import prisma from '@/lib/prisma'

// Whisper limit is 25 MB
const MAX_BYTES = 25 * 1024 * 1024

// MIME types and their magic byte signatures
const ALLOWED_TYPES: Record<string, { mime: string; magic: number[][] }> = {
  mp3: { mime: 'audio/mpeg', magic: [[0x49, 0x44, 0x33], [0xff, 0xfb], [0xff, 0xf3], [0xff, 0xf2]] },
  mp4: { mime: 'video/mp4', magic: [[0x66, 0x74, 0x79, 0x70]] }, // 'ftyp' at offset 4
  m4a: { mime: 'audio/mp4', magic: [[0x66, 0x74, 0x79, 0x70]] },
  wav: { mime: 'audio/wav', magic: [[0x52, 0x49, 0x46, 0x46]] }, // 'RIFF'
  webm: { mime: 'audio/webm', magic: [[0x1a, 0x45, 0xdf, 0xa3]] },
}

function detectMimeFromBytes(buf: Uint8Array): string | null {
  // mp4/m4a: check bytes 4-7 for 'ftyp'
  if (buf.length >= 8) {
    const ftyp = [0x66, 0x74, 0x79, 0x70]
    if (ftyp.every((b, i) => buf[i + 4] === b)) return 'audio/mp4'
  }
  for (const [, { mime, magic }] of Object.entries(ALLOWED_TYPES)) {
    if (mime === 'audio/mp4') continue // handled above
    for (const sig of magic) {
      if (sig.every((b, i) => buf[i] === b)) return mime
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  const user = await requireSession().catch(() => null)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const opportunityId = formData.get('opportunityId') as string | null

  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 25 MB limit (Whisper max)' }, { status: 413 })
  }

  // Validate magic bytes
  const headerBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const detectedMime = detectMimeFromBytes(headerBytes)
  if (!detectedMime) {
    return NextResponse.json({ error: 'Unsupported file type. Use mp3, mp4, m4a, wav, or webm.' }, { status: 415 })
  }

  // Verify opportunityId belongs to org if provided
  if (opportunityId) {
    const opp = await prisma.opportunity.findFirst({
      where: { id: opportunityId, orgId: user.orgId },
    })
    if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'mp3'
  const audioPath = `${user.orgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  // Upload to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    await uploadRecording(audioPath, buffer, detectedMime)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Storage upload failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // Create Call record
  const call = await prisma.call.create({
    data: {
      orgId: user.orgId,
      ownerId: user.id,
      opportunityId: opportunityId ?? null,
      audioPath,
      status: 'pending',
    },
  })

  // Fire Inngest event to kick off transcription
  await inngest.send({
    name: 'call/uploaded',
    data: { callId: call.id, orgId: user.orgId, audioPath },
  })

  return NextResponse.json({ callId: call.id, status: 'pending' }, { status: 201 })
}
