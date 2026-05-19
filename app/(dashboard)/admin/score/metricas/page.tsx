import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'

export const metadata = { title: 'Métricas de score — Administración' }

const LETRA_LABEL: Record<string, string> = {
  A: 'Bajo riesgo',
  B: 'Riesgo moderado',
  C: 'Alto riesgo',
  D: 'No aprobado',
}

const letraBg: Record<string, string> = {
  A: 'bg-[#dcfce7] text-[#15803d]',
  B: 'bg-[#fef9c3] text-[#a16207]',
  C: 'bg-[#ffedd5] text-[#c2410c]',
  D: 'bg-[#fee2e2] text-[#b91c1c]',
}

export default async function ScoreMetricasPage() {
  const supabase = createClient()

  const { data: rows } = await supabase
    .from('acreditados')
    .select('clasificacion_modelo, calificacion_promotor, puntaje_total')

  const list = (rows ?? []) as Array<{
    clasificacion_modelo: string | null
    calificacion_promotor: string | null
    puntaje_total: number | null
  }>

  const total = list.length
  const sinEvaluar = list.filter(r => !r.calificacion_promotor).length
  const promedio =
    total > 0
      ? list.reduce((s, r) => s + (r.puntaje_total ?? 0), 0) / total
      : 0

  const distModelo: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
  for (const r of list) {
    const letra = r.clasificacion_modelo
    if (letra && letra in distModelo) distModelo[letra]++
  }

  return (
    <div>
      <Header
        title="Métricas de score"
        subtitle="Resumen del portafolio de acreditados capturados en el sistema."
      />

      <div className="px-5 md:px-9 pb-12 flex flex-col gap-8 max-w-3xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total acreditados', value: String(total) },
            { label: 'Sin evaluar', value: String(sinEvaluar) },
            { label: 'Promedio score', value: total > 0 ? promedio.toFixed(1) : '—' },
            { label: 'Evaluados', value: String(total - sinEvaluar) },
          ].map(({ label, value }) => (
            <div key={label} className="border border-[#ECECEC] rounded-md px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.3px] text-ink-400 font-medium">{label}</p>
              <p className="text-[24px] font-semibold text-navy mt-1">{value}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.4px] text-ink-400 font-medium mb-3">
            Distribución por clasificación del modelo
          </p>
          <div className="border border-[#ECECEC] rounded-md overflow-hidden">
            {(['A', 'B', 'C', 'D'] as const).map((letra, i) => (
              <div
                key={letra}
                className={`flex items-center justify-between px-5 py-3 ${i < 3 ? 'border-b border-[#F5F5F5]' : ''}`}
              >
                <span className={`text-[12px] font-bold px-2 py-1 rounded ${letraBg[letra]}`}>
                  {letra} — {LETRA_LABEL[letra]}
                </span>
                <span className="text-[13px] font-medium text-ink-900">
                  {distModelo[letra]}
                  {total > 0 && (
                    <span className="text-ink-400 font-normal ml-1">
                      ({Math.round((distModelo[letra] / total) * 100)}%)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/score/acreditados"
          className="text-[12.5px] text-orange hover:text-orange-dark font-medium transition-colors w-fit"
        >
          Ver listado de acreditados →
        </Link>
      </div>
    </div>
  )
}