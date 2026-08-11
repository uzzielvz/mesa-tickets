import Header from '@/components/layout/header'
import TicketListSkeleton from '@/components/tickets/ticket-list-skeleton'

export default function ColaAreaLoading() {
  return (
    <div>
      <Header title="Cola del área" subtitle="Cargando..." />
      <TicketListSkeleton rows={5} />
    </div>
  )
}
