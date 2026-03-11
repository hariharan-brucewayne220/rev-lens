import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession()
  if (!user) redirect('/auth/signin')

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex h-screen bg-[#0a0c14] overflow-hidden">
      <Sidebar userInitials={initials} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
