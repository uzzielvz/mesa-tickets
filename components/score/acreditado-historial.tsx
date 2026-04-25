import { formatDate, formatName } from '@/lib/utils/format'

interface HistorialEntry {
  id: string
  campo: string
  valor_antes: string | null
  valor_despues: string | null
  created_at: string
  profiles: { nombre_completo: string; email: string } | null
}

const CAMPO_LABEL: Record<string, string> = {
  nombre_completo: 'Nombre',
  clave: 'Clave',
  ciclo: 'Ciclo',
  fecha_nacimiento: 'Fecha de nacimiento',
  tiempo_residencia: 'Tiempo de residencia',
  antiguedad_negocio: 'Antigüedad negocio',
  dependientes: 'Dependientes',
  antiguedad_telefono: 'Antigüedad telefónica',
  cuenta_banco: 'Cuenta bancaria',
  casa_habitacion: 'Casa habitación',
  estado_civil: 'Estado civil',
  negocio_domicilio: 'Negocio en domicilio',
  destino_credito: 'Destino crédito',
  automovil_propio: 'Automóvil propio',
  buro_credito: 'Buró de crédito',
  tipo_garantia: 'Tipo de garantía',
  tipo_negocio: 'Tipo de negocio',
  genero: 'Género',
}

export default function AcreditadoHistorial({ historial }: { historial: HistorialEntry[] }) {
  if (historial.length === 0) {
    return (
      <div className="border border-[#ECECEC] rounded-md px-5 py-6 text-center">
        <p className="text-[13px] text-ink-400">Sin ediciones registradas.</p>
      </div>
    )
  }

  return (
    <div className="border border-[#ECECEC] rounded-md overflow-hidden">
      <div className="hidden md:grid grid-cols-[160px_1fr_1fr_140px] px-5 py-2 bg-surface-sidebar border-b border-[#ECECEC]">
        {['Campo', 'Antes', 'Después', 'Editado por'].map(h => (
          <span key={h} className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{h}</span>
        ))}
      </div>

      {historial.map((entry, i) => (
        <div
          key={entry.id}
          className={`grid grid-cols-1 md:grid-cols-[160px_1fr_1fr_140px] items-start px-5 py-3 gap-1 md:gap-3 ${i < historial.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
        >
          <span className="text-[12.5px] font-medium text-ink-900">
            {CAMPO_LABEL[entry.campo] ?? entry.campo}
          </span>
          <span className="text-[12.5px] text-ink-400 line-through">
            {entry.valor_antes ?? '—'}
          </span>
          <span className="text-[12.5px] text-ink-700">
            {entry.valor_despues ?? '—'}
          </span>
          <div>
            <p className="text-[12px] text-ink-700">
              {entry.profiles
                ? formatName(entry.profiles.nombre_completo, entry.profiles.email)
                : '—'}
            </p>
            <p className="text-[11px] text-ink-400">{formatDate(entry.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
