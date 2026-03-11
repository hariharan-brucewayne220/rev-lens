import type { SessionUser } from '@/lib/types'

declare module 'next-auth' {
  interface Session {
    user: SessionUser
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    orgId: string
    role: SessionUser['role']
  }
}
