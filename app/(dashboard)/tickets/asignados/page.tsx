import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import TicketList from '@/components/tickets/ticket-list'

export default async function AsignadosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tickets } = await supabase
    .from('tickets_with_status')
    .select('*')
    .eq('responsable_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <Header
        title="Asignados a mí"
        subtitle={`${tickets?.length ?? 0} tickets activos`}
        action={
          <Link
            href="/tickets/nuevo"
            className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-[14px] py-[7px] transition-colors"
          >
            Nuevo ticket
          </Link>
        }
      />
      <TicketList
        tickets={tickets ?? []}
        emptyMessage="No tienes tickets asignados."
        showResponsable={false}
      />
    </div>
  )
}
