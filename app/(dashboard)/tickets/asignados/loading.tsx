import Header from '@/components/layout/header'
import TicketListSkeleton from '@/components/tickets/ticket-list-skeleton'

export default function AsignadosLoading() {
  return (
    <div>
      <Header title="Asignados a mí" subtitle="Cargando..." />
      <TicketListSkeleton rows={5} />
    </div>
  )
}
