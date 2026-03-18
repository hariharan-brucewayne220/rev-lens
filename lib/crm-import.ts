import { z } from 'zod'
import Papa from 'papaparse'
import prisma from '@/lib/prisma'

// ── Zod schemas per entity type ────────────────────────────────────────────

const accountRowSchema = z.object({
  crmId: z.string().min(1, 'crmId required'),
  name: z.string().min(1, 'name required'),
  industry: z.string().optional(),
  website: z.string().optional(),
})

const contactRowSchema = z.object({
  accountCrmId: z.string().min(1, 'accountCrmId required'),
  name: z.string().min(1, 'name required'),
  email: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
})

const opportunityRowSchema = z.object({
  crmId: z.string().min(1, 'crmId required'),
  name: z.string().min(1, 'name required'),
  accountCrmId: z.string().min(1, 'accountCrmId required'),
  ownerEmail: z.string().min(1, 'ownerEmail required'),
  stage: z.string().min(1, 'stage required'),
  amount: z.string().min(1, 'amount required'),
  closeDate: z.string().min(1, 'closeDate required'),
  forecastCategory: z
    .enum(['commit', 'best_case', 'pipeline', 'omitted'])
    .optional()
    .default('pipeline'),
})

// ── Types ───────────────────────────────────────────────────────────────────

export type CRMEntityType = 'account' | 'contact' | 'opportunity'

export interface ImportResult {
  rowsTotal: number
  rowsSuccess: number
  rowsFailed: number
  errorRows: Array<{ row: number; error: string }>
}

// ── CSV parsing ─────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  })
  if (result.errors.length > 0) {
    const first = result.errors[0]
    throw new Error(`CSV parse error at row ${first.row}: ${first.message}`)
  }
  return result.data
}

// ── Entity upsert functions ─────────────────────────────────────────────────

async function upsertAccounts(orgId: string, rows: Record<string, string>[]): Promise<ImportResult> {
  const errorRows: ImportResult['errorRows'] = []
  let rowsSuccess = 0

  for (let i = 0; i < rows.length; i++) {
    const parsed = accountRowSchema.safeParse(rows[i])
    if (!parsed.success) {
      errorRows.push({ row: i + 2, error: parsed.error.issues[0].message })
      continue
    }
    const { crmId, name, industry, website } = parsed.data
    try {
      await prisma.account.upsert({
        where: { orgId_crmId: { orgId, crmId } },
        create: { orgId, crmId, name, industry, website },
        update: { name, industry, website },
      })
      rowsSuccess++
    } catch {
      errorRows.push({ row: i + 2, error: 'Database error during upsert' })
    }
  }

  return { rowsTotal: rows.length, rowsSuccess, rowsFailed: errorRows.length, errorRows }
}

async function upsertContacts(orgId: string, rows: Record<string, string>[]): Promise<ImportResult> {
  const errorRows: ImportResult['errorRows'] = []
  let rowsSuccess = 0

  for (let i = 0; i < rows.length; i++) {
    const parsed = contactRowSchema.safeParse(rows[i])
    if (!parsed.success) {
      errorRows.push({ row: i + 2, error: parsed.error.issues[0].message })
      continue
    }
    const { accountCrmId, name, email, title, phone } = parsed.data

    const account = await prisma.account.findUnique({
      where: { orgId_crmId: { orgId, crmId: accountCrmId } },
    })
    if (!account) {
      errorRows.push({ row: i + 2, error: `Account with crmId "${accountCrmId}" not found` })
      continue
    }

    try {
      await prisma.contact.create({ data: { orgId, accountId: account.id, name, email, title, phone } })
      rowsSuccess++
    } catch {
      errorRows.push({ row: i + 2, error: 'Database error during insert' })
    }
  }

  return { rowsTotal: rows.length, rowsSuccess, rowsFailed: errorRows.length, errorRows }
}

async function upsertOpportunities(orgId: string, rows: Record<string, string>[]): Promise<ImportResult> {
  const errorRows: ImportResult['errorRows'] = []
  let rowsSuccess = 0

  for (let i = 0; i < rows.length; i++) {
    const parsed = opportunityRowSchema.safeParse(rows[i])
    if (!parsed.success) {
      errorRows.push({ row: i + 2, error: parsed.error.issues[0].message })
      continue
    }
    const { crmId, name, accountCrmId, ownerEmail, stage, amount, closeDate, forecastCategory } = parsed.data

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum)) {
      errorRows.push({ row: i + 2, error: `Invalid amount: "${amount}"` })
      continue
    }

    const closeDateObj = new Date(closeDate)
    if (isNaN(closeDateObj.getTime())) {
      errorRows.push({ row: i + 2, error: `Invalid closeDate: "${closeDate}"` })
      continue
    }

    const [account, owner] = await Promise.all([
      prisma.account.findUnique({ where: { orgId_crmId: { orgId, crmId: accountCrmId } } }),
      prisma.user.findFirst({ where: { orgId, email: ownerEmail.toLowerCase() } }),
    ])

    if (!account) {
      errorRows.push({ row: i + 2, error: `Account "${accountCrmId}" not found` })
      continue
    }
    if (!owner) {
      errorRows.push({ row: i + 2, error: `User "${ownerEmail}" not found in org` })
      continue
    }

    try {
      await prisma.opportunity.upsert({
        where: { orgId_crmId: { orgId, crmId } },
        create: {
          orgId,
          crmId,
          name,
          accountId: account.id,
          ownerId: owner.id,
          stage,
          amount: amountNum,
          closeDate: closeDateObj,
          forecastCategory,
        },
        update: { name, stage, amount: amountNum, closeDate: closeDateObj, forecastCategory },
      })
      rowsSuccess++
    } catch {
      errorRows.push({ row: i + 2, error: 'Database error during upsert' })
    }
  }

  return { rowsTotal: rows.length, rowsSuccess, rowsFailed: errorRows.length, errorRows }
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function importCSV(
  orgId: string,
  entityType: CRMEntityType,
  csvText: string,
): Promise<ImportResult> {
  const rows = parseCSV(csvText)
  if (rows.length === 0) return { rowsTotal: 0, rowsSuccess: 0, rowsFailed: 0, errorRows: [] }

  switch (entityType) {
    case 'account':
      return upsertAccounts(orgId, rows)
    case 'contact':
      return upsertContacts(orgId, rows)
    case 'opportunity':
      return upsertOpportunities(orgId, rows)
  }
}
