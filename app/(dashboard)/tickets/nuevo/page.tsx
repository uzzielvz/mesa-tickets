import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import TicketForm from '@/components/tickets/ticket-form'

interface PageProps {
  searchParams: { area?: string; tipo?: string }
}

export default async function NuevoTicketPage({ searchParams }: PageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: areas }, { data: catalog }] = await Promise.all([
    supabase.from('areas').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('problem_catalog').select('*').eq('activo', true).order('nombre'),
  ])

  return (
    <div>
      <Header title="Nuevo ticket" subtitle="Describe el problema para que el área responsable pueda atenderte." />
      <div className="px-5 md:px-9 pb-12 max-w-2xl">
        <TicketForm
          areas={areas ?? []}
          catalog={catalog ?? []}
          userId={user.id}
          initialAreaId={searchParams.area}
          initialProblemId={searchParams.tipo}
        />
      </div>
    </div>
  )
}
