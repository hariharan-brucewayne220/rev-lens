'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard, GitBranch, Building2, Phone,
  TrendingUp, AlertTriangle, Users, Settings, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/pipeline', icon: GitBranch, label: 'Pipeline' },
  { href: '/accounts', icon: Building2, label: 'Accounts' },
  { href: '/calls', icon: Phone, label: 'Calls' },
  { href: '/forecast', icon: TrendingUp, label: 'Forecast' },
  { href: '/renewals', icon: AlertTriangle, label: 'Renewals' },
  { href: '/team', icon: Users, label: 'Team' },
]

export function Sidebar({ userInitials }: { userInitials: string }) {
  const pathname = usePathname()

  return (
    <aside className="w-14 flex-shrink-0 bg-[#0f1117] border-r border-[#1e2130] flex flex-col items-center py-4 gap-1">
      <Link href="/dashboard" className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm mb-4">
        R
      </Link>

      {navItems.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          title={label}
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
            pathname.startsWith(href)
              ? 'bg-[#1e2130] text-indigo-400'
              : 'text-slate-500 hover:bg-[#1e2130] hover:text-slate-300'
          )}
        >
          <Icon size={18} />
        </Link>
      ))}

      <div className="mt-auto flex flex-col items-center gap-2">
        <Link
          href="/admin"
          title="Settings"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 hover:bg-[#1e2130] hover:text-slate-300 transition-colors"
        >
          <Settings size={18} />
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          title="Sign out"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 hover:bg-[#1e2130] hover:text-slate-300 transition-colors"
        >
          <LogOut size={18} />
        </button>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-red-500 flex items-center justify-center text-[10px] font-bold text-white">
          {userInitials}
        </div>
      </div>
    </aside>
  )
}
