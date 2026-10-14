import { Bell, AlertTriangle } from 'lucide-react'
import { textoAvisos, type ResultadoAvisos } from '@/lib/auditor/tipos'

/** El renglón de cada acuse de carga que dice a quién se avisó, o por qué no (AUD-005). */
export default function AcuseAvisos({ resultado }: { resultado?: ResultadoAvisos | null }) {
  const t = textoAvisos(resultado)
  if (!t) return null
  return (
    <p className={`flex items-start gap-1.5 text-[12.5px] ${t.alerta ? 'text-[#8A6100]' : 'text-ink-700'}`}>
      {t.alerta ? <AlertTriangle size={13} className="mt-0.5 shrink-0" /> : <Bell size={13} className="mt-0.5 shrink-0 text-ink-400" />}
      <span>{t.texto}</span>
    </p>
  )
}
