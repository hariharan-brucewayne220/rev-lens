import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const user = await requireSession().catch(() => null)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, role } = await req.json()
  if (!email || !role) {
    return NextResponse.json({ error: 'email and role are required' }, { status: 400 })
  }

  // Check not already a member
  const existing = await prisma.user.findFirst({ where: { orgId: user.orgId, email } })
  if (existing) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 })
  }

  const invite = await prisma.invite.create({
    data: {
      orgId: user.orgId,
      email: email.toLowerCase(),
      role,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  })

  const signupUrl = `${process.env.NEXTAUTH_URL}/auth/signup?token=${invite.token}`
  return NextResponse.json({ token: invite.token, signupUrl })
}

export async function GET(req: NextRequest) {
  const user = await requireSession().catch(() => null)
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const invites = await prisma.invite.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(invites)
}
