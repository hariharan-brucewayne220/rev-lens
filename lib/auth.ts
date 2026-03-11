import { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { compare, hash } from 'bcryptjs'
import prisma from '@/lib/prisma'
import type { SessionUser } from '@/lib/types'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findFirst({
          where: { email: credentials.email.toLowerCase() },
        })
        if (!user?.password) return null
        const valid = await compare(credentials.password, user.password)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.name, orgId: user.orgId, role: user.role }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Google OAuth: reject if user hasn't been invited (no DB record)
      if (account?.provider === 'google') {
        const existing = await prisma.user.findFirst({ where: { email: user.email! } })
        if (!existing) return '/auth/signin?error=not_invited'
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        // Credentials provider — user object already has our fields
        token.id = user.id
        token.orgId = (user as SessionUser).orgId
        token.role = (user as SessionUser).role
      }
      if (account?.provider === 'google' && !token.orgId) {
        // Google OAuth — look up our DB record to get orgId + role
        const dbUser = await prisma.user.findFirst({ where: { email: token.email! } })
        if (dbUser) {
          token.id = dbUser.id
          token.orgId = dbUser.orgId
          token.role = dbUser.role
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user = {
        id: token.id as string,
        email: token.email!,
        name: token.name!,
        orgId: token.orgId as string,
        role: token.role as SessionUser['role'],
      }
      return session
    },
  },
}

// Typed server session helper — use this in Server Components and API routes
export async function getSession(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  return (session?.user as SessionUser) ?? null
}

// Throws if not authenticated — use in API routes
export async function requireSession(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) throw new Error('Unauthorized')
  return user
}

export { hash as hashPassword }
