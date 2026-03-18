import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { importCSV, type CRMEntityType } from '@/lib/crm-import'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const VALID_ENTITY_TYPES: CRMEntityType[] = ['account', 'contact', 'opportunity']

export async function POST(req: NextRequest) {
  const user = await requireSession().catch(() => null)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const entityType = formData.get('entityType') as string | null

  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (!entityType || !VALID_ENTITY_TYPES.includes(entityType as CRMEntityType)) {
    return NextResponse.json({ error: 'entityType must be account, contact, or opportunity' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 413 })
  }

  const csvText = await file.text()

  // Create tracking record
  const crmImport = await prisma.cRMImport.create({
    data: {
      orgId: user.orgId,
      importedBy: user.id,
      entityType: entityType as CRMEntityType,
      fileName: file.name,
      status: 'processing',
    },
  })

  let result
  try {
    result = await importCSV(user.orgId, entityType as CRMEntityType, csvText)
  } catch (err) {
    await prisma.cRMImport.update({
      where: { id: crmImport.id },
      data: { status: 'failed' },
    })
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 422 })
  }

  await prisma.cRMImport.update({
    where: { id: crmImport.id },
    data: {
      rowsTotal: result.rowsTotal,
      rowsSuccess: result.rowsSuccess,
      rowsFailed: result.rowsFailed,
      errorRows: result.errorRows,
      status: 'done',
    },
  })

  return NextResponse.json({ importId: crmImport.id, ...result })
}

export async function GET(req: NextRequest) {
  const user = await requireSession().catch(() => null)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const imports = await prisma.cRMImport.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json({ imports })
}
