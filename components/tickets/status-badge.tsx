const STATUS_CONFIG = {
  abierto:    { color: '#2563EB', label: 'Abierto' },
  contestado: { color: '#C88A04', label: 'Contestado' },
  terminado:  { color: '#F58220', label: 'Terminado' },
  cerrado:    { color: '#15803D', label: 'Cerrado' },
} as const

type Status = keyof typeof STATUS_CONFIG

export default function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as Status] ?? STATUS_CONFIG.abierto

  return (
    <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-900">
      <span style={{ color: config.color }}>●</span>
      {config.label}
    </span>
  )
}
