import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { encryptSecrets, decryptSecrets } from '@/lib/secrets'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const user = await requireSession().catch(() => null)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { key } = await req.json()
  if (!key || typeof key !== 'string' || !key.startsWith('sk-')) {
    return NextResponse.json({ error: 'Invalid OpenAI key format' }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({ where: { id: user.orgId } })
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  const existing = decryptSecrets(org.encryptedSecrets as string | null) ?? {}
  const updated = encryptSecrets({ ...existing, openAiKey: key })

  await prisma.organization.update({
    where: { id: user.orgId },
    data: { encryptedSecrets: updated },
  })

  return NextResponse.json({ ok: true })
}
