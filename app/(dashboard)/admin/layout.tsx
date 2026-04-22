import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, rol')
    .eq('id', user.id)
    .single()

  if (!profile || (profile as { rol: string }).rol !== 'admin') redirect('/dashboard')

  return <>{children}</>
}
