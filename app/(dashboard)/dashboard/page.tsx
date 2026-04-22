import Header from '@/components/layout/header'

export default function DashboardPage() {
  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="Resumen de actividad"
      />
      <div className="px-9">
        <p className="text-[13px] text-ink-400">Próximamente — métricas y contadores.</p>
      </div>
    </div>
  )
}
