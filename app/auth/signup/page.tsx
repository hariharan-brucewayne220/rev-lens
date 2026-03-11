import { notFound } from 'next/navigation'
import { SignupForm } from '@/components/auth/signup-form'
import prisma from '@/lib/prisma'

export default async function SignupPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token
  if (!token) notFound()

  const invite = await prisma.invite.findUnique({ where: { token } })
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return (
      <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg">This invite link is invalid or has expired.</p>
          <a href="/auth/signin" className="mt-4 text-indigo-400 text-sm underline block">
            Sign in instead
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg">
            R
          </div>
          <span className="text-xl font-bold text-slate-100">RevLens</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Create your account</h1>
        <p className="text-slate-400 mb-8 text-sm">You've been invited to join RevLens</p>
        <SignupForm token={token} email={invite.email} role={invite.role} />
      </div>
    </div>
  )
}
