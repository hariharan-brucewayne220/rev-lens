import { SignInForm } from '@/components/auth/signin-form'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#0a0c14] flex items-center justify-content">
      <div className="w-full max-w-sm mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg">
            R
          </div>
          <span className="text-xl font-bold text-slate-100">RevLens</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Welcome back</h1>
        <p className="text-slate-400 mb-8 text-sm">Sign in to your account</p>
        <SignInForm />
      </div>
    </div>
  )
}
