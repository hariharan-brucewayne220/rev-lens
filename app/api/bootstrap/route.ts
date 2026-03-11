import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (process.env.ALLOW_BOOTSTRAP_SIGNUP !== 'true') {
    return NextResponse.json({ error: 'Bootstrap is disabled' }, { status: 403 })
  }

  const count = await prisma.organization.count()
  if (count > 0) {
    return NextResponse.json({ error: 'Organization already exists' }, { status: 409 })
  }

  const { orgName, adminName, adminEmail, adminPassword } = await req.json()
  if (!orgName || !adminName || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }
  if (adminPassword.length < 8) {
    return NextResponse.json({ error: 'Password min 8 characters' }, { status: 400 })
  }

  const hashed = await hashPassword(adminPassword, 12)

  const org = await prisma.organization.create({ data: { name: orgName } })
  await prisma.user.create({
    data: {
      orgId: org.id,
      email: adminEmail.toLowerCase(),
      name: adminName,
      role: 'admin',
      password: hashed,
    },
  })

  return NextResponse.json({ success: true, orgId: org.id })
}
