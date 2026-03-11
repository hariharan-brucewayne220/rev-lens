import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const invite = await prisma.invite.findUnique({ where: { token: params.token } })
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 })
  }
  return NextResponse.json({ email: invite.email, role: invite.role })
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const invite = await prisma.invite.findUnique({ where: { token: params.token } })
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 })
  }

  const { name, password } = await req.json()
  if (!name || !password || password.length < 8) {
    return NextResponse.json({ error: 'name and password (min 8 chars) required' }, { status: 400 })
  }

  const hashed = await hashPassword(password, 12)

  await prisma.$transaction([
    prisma.user.create({
      data: {
        orgId: invite.orgId,
        email: invite.email,
        name,
        role: invite.role,
        password: hashed,
      },
    }),
    prisma.invite.update({
      where: { token: params.token },
      data: { acceptedAt: new Date() },
    }),
  ])

  return NextResponse.json({ success: true })
}
