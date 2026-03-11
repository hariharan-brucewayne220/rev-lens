import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireSession: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  updateOpportunityStage: vi.fn(),
}))

import { requireSession } from '@/lib/auth'
import { updateOpportunityStage } from '@/lib/db'
import { PATCH } from '@/app/api/opportunities/[id]/stage/route'

const mockUser = { id: 'u1', orgId: 'org1', role: 'admin' as const, email: 'a@b.com', name: 'A' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/opportunities/[id]/stage', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireSession).mockRejectedValue(new Error('Unauthorized'))
    const req = new NextRequest('http://localhost/api/opportunities/opp1/stage', {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'Demo' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: { id: 'opp1' } })
    expect(res.status).toBe(401)
  })

  it('returns 400 when stage is missing', async () => {
    vi.mocked(requireSession).mockResolvedValue(mockUser)
    const req = new NextRequest('http://localhost/api/opportunities/opp1/stage', {
      method: 'PATCH',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: { id: 'opp1' } })
    expect(res.status).toBe(400)
  })

  it('updates stage and returns 200 on success', async () => {
    vi.mocked(requireSession).mockResolvedValue(mockUser)
    vi.mocked(updateOpportunityStage).mockResolvedValue({ id: 'opp1', stage: 'Demo' } as never)
    const req = new NextRequest('http://localhost/api/opportunities/opp1/stage', {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'Demo' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: { id: 'opp1' } })
    expect(res.status).toBe(200)
    expect(updateOpportunityStage).toHaveBeenCalledWith(
      { orgId: 'org1', userId: 'u1', role: 'admin' },
      'opp1',
      'Demo'
    )
  })

  it('returns 404 when opportunity not found', async () => {
    vi.mocked(requireSession).mockResolvedValue(mockUser)
    vi.mocked(updateOpportunityStage).mockRejectedValue(new Error('Not found'))
    const req = new NextRequest('http://localhost/api/opportunities/opp1/stage', {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'Demo' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: { id: 'opp1' } })
    expect(res.status).toBe(404)
  })

  it('returns 500 for unexpected errors', async () => {
    vi.mocked(requireSession).mockResolvedValue(mockUser)
    vi.mocked(updateOpportunityStage).mockRejectedValue(new Error('DB connection failed'))
    const req = new NextRequest('http://localhost/api/opportunities/opp1/stage', {
      method: 'PATCH',
      body: JSON.stringify({ stage: 'Demo' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: { id: 'opp1' } })
    expect(res.status).toBe(500)
  })
})
