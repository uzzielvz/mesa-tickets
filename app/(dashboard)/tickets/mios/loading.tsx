import Header from '@/components/layout/header'
import TicketListSkeleton from '@/components/tickets/ticket-list-skeleton'

export default function MisTicketsLoading() {
  return (
    <div>
      <Header title="Mis tickets" subtitle="Cargando..." />
      <TicketListSkeleton rows={5} />
    </div>
  )
}
