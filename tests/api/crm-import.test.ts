import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockAccountFindUnique,
  mockAccountUpsert,
  mockContactCreate,
  mockOpportunityUpsert,
  mockUserFindFirst,
} = vi.hoisted(() => ({
  mockAccountFindUnique: vi.fn(),
  mockAccountUpsert: vi.fn(),
  mockContactCreate: vi.fn(),
  mockOpportunityUpsert: vi.fn(),
  mockUserFindFirst: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    account: { upsert: mockAccountUpsert, findUnique: mockAccountFindUnique },
    contact: { create: mockContactCreate },
    opportunity: { upsert: mockOpportunityUpsert },
    user: { findFirst: mockUserFindFirst },
  },
}))

import { importCSV } from '@/lib/crm-import'

const ORG = 'org-1'

describe('importCSV — accounts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts valid account rows', async () => {
    mockAccountUpsert.mockResolvedValue({})
    const csv = 'crmId,name,industry\nacc-1,Acme Corp,SaaS\nacc-2,BetaCo,Fintech'
    const result = await importCSV(ORG, 'account', csv)
    expect(result.rowsTotal).toBe(2)
    expect(result.rowsSuccess).toBe(2)
    expect(result.rowsFailed).toBe(0)
    expect(mockAccountUpsert).toHaveBeenCalledTimes(2)
  })

  it('records error for row missing required crmId', async () => {
    const csv = 'crmId,name\n,Missing CRM ID'
    const result = await importCSV(ORG, 'account', csv)
    expect(result.rowsFailed).toBe(1)
    expect(result.errorRows[0].row).toBe(2)
    expect(result.errorRows[0].error).toMatch(/crmId required/)
    expect(mockAccountUpsert).not.toHaveBeenCalled()
  })

  it('returns zero counts for empty CSV', async () => {
    const csv = 'crmId,name\n'
    const result = await importCSV(ORG, 'account', csv)
    expect(result.rowsTotal).toBe(0)
    expect(result.rowsSuccess).toBe(0)
  })
})

describe('importCSV — contacts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates contact linked to existing account', async () => {
    mockAccountFindUnique.mockResolvedValue({ id: 'acc-db-1' })
    mockContactCreate.mockResolvedValue({})
    const csv = 'accountCrmId,name,email\nacc-1,Jane Doe,jane@example.com'
    const result = await importCSV(ORG, 'contact', csv)
    expect(result.rowsSuccess).toBe(1)
    expect(mockContactCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accountId: 'acc-db-1' }) })
    )
  })

  it('errors when account crmId not found', async () => {
    mockAccountFindUnique.mockResolvedValue(null)
    const csv = 'accountCrmId,name\nunknown-acc,John'
    const result = await importCSV(ORG, 'contact', csv)
    expect(result.rowsFailed).toBe(1)
    expect(result.errorRows[0].error).toMatch(/not found/)
    expect(mockContactCreate).not.toHaveBeenCalled()
  })
})

describe('importCSV — opportunities', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts valid opportunity rows', async () => {
    mockAccountFindUnique.mockResolvedValue({ id: 'acc-db-1' })
    mockUserFindFirst.mockResolvedValue({ id: 'user-1' })
    mockOpportunityUpsert.mockResolvedValue({})
    const csv = 'crmId,name,accountCrmId,ownerEmail,stage,amount,closeDate\nopp-1,Deal A,acc-1,rep@co.com,Demo,50000,2025-06-30'
    const result = await importCSV(ORG, 'opportunity', csv)
    expect(result.rowsSuccess).toBe(1)
    expect(mockOpportunityUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ amount: 50000 }) })
    )
  })

  it('errors on invalid amount', async () => {
    mockAccountFindUnique.mockResolvedValue({ id: 'acc-db-1' })
    mockUserFindFirst.mockResolvedValue({ id: 'user-1' })
    const csv = 'crmId,name,accountCrmId,ownerEmail,stage,amount,closeDate\nopp-1,Deal,acc-1,rep@co.com,Demo,notanumber,2025-06-30'
    const result = await importCSV(ORG, 'opportunity', csv)
    expect(result.rowsFailed).toBe(1)
    expect(result.errorRows[0].error).toMatch(/Invalid amount/)
  })

  it('errors when owner email not in org', async () => {
    mockAccountFindUnique.mockResolvedValue({ id: 'acc-db-1' })
    mockUserFindFirst.mockResolvedValue(null)
    const csv = 'crmId,name,accountCrmId,ownerEmail,stage,amount,closeDate\nopp-1,Deal,acc-1,ghost@co.com,Demo,1000,2025-06-30'
    const result = await importCSV(ORG, 'opportunity', csv)
    expect(result.rowsFailed).toBe(1)
    expect(result.errorRows[0].error).toMatch(/not found/)
  })
})
