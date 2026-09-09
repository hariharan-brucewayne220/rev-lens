import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: { user: { findMany: vi.fn() } },
}))

import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

// bcrypt hash of 'correct-horse'
const HASH = '$2b$10$vngm5erZ4zpFTjUiasR5CeNPedi3aTTOYlPYhhewQrGqs1FHt.3ui'

const acmeUser = {
  id: 'u-acme', orgId: 'org-acme', email: 'shared@dup.test',
  name: 'Dup Acme', role: 'rep', password: HASH,
}
const globexUser = {
  id: 'u-globex', orgId: 'org-globex', email: 'shared@dup.test',
  name: 'Dup Globex', role: 'rep', password: HASH,
}

type Authorizer = { authorize: (c: unknown) => Promise<unknown>; options?: Authorizer }

function authorize(email: string, password: string) {
  const provider = authOptions.providers.find((p) => p.id === 'credentials') as unknown as Authorizer
  // next-auth v4 keeps the caller's config under `options`, merging it only at runtime
  const fn = provider.options?.authorize ?? provider.authorize
  return fn({ email, password })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('credentials authorize — tenant resolution', () => {
  it('signs in when the email matches exactly one org', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([acmeUser] as never)
    const user = await authorize('shared@dup.test', 'correct-horse')
    expect(user).toMatchObject({ id: 'u-acme', orgId: 'org-acme' })
  })

  it('refuses to sign in when the email exists in more than one org', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([acmeUser, globexUser] as never)
    const user = await authorize('shared@dup.test', 'correct-horse')
    expect(user).toBeNull()
  })

  it('returns null when the email matches no user', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never)
    const user = await authorize('nobody@dup.test', 'correct-horse')
    expect(user).toBeNull()
  })

  it('lowercases the email before lookup', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([acmeUser] as never)
    await authorize('Shared@Dup.Test', 'correct-horse')
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { email: 'shared@dup.test' },
      take: 2,
    })
  })
})
