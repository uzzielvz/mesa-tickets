import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { puedeEditarAcreditado } from '@/lib/utils/score-permissions'
import AcreditadoForm from '@/components/score/acreditado-form'
import type { Referencia } from '@/lib/scoring/types'

export const metadata = { title: 'Editar acreditado — Score Crediticio' }

type AcreditadoRow = {
  id: string
  numero: number
  clave: string
  nombre_completo: string
  ciclo: string
  fecha_nacimiento: string
  tiempo_residencia: number
  antiguedad_negocio: number
  dependientes: number
  antiguedad_telefono: number
  cuenta_banco: number
  casa_habitacion: string
  estado_civil: string
  negocio_domicilio: boolean
  destino_credito: string
  automovil_propio: boolean
  buro_credito: string
  tipo_garantia: string
  tipo_negocio: string
  genero: string
  capturado_por_id: string
  acreditado_referencias: Array<{ calidad: string; nombre_referencia: string | null }>
}

export default async function EditarAcreditadoPage({
  params,
}: {
  params: { numero: string }
}) {
  const supabase = createClient()
  const numeroInt = parseInt(params.numero)
  if (isNaN(numeroInt)) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: raw } = await supabase
    .from('acreditados')
    .select('*, acreditado_referencias(calidad, nombre_referencia)')
    .eq('numero', numeroInt)
    .single()

  if (!raw) notFound()

  const acreditado = raw as unknown as AcreditadoRow

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_score')
    .eq('id', user.id)
    .single()

  const rol = (profile as { rol: string; acceso_score?: boolean } | null)?.rol ?? 'usuario'
  const accesoScore = (profile as { acceso_score?: boolean } | null)?.acceso_score === true

  if (!puedeEditarAcreditado(user.id, acreditado.capturado_por_id, rol, accesoScore)) {
    redirect(`/score/acreditados/${acreditado.numero}`)
  }

  const refs = (acreditado.acreditado_referencias ?? []) as Referencia[]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/score/acreditados/${acreditado.numero}`}
          className="flex items-center gap-1 text-[12.5px] text-ink-400 hover:text-ink-700 transition-colors"
        >
          <ChevronLeft size={13} />
          {acreditado.nombre_completo}
        </Link>
        <span className="text-ink-300 text-[12.5px]">/</span>
        <span className="text-[12.5px] text-ink-700">Editar</span>
      </div>

      <h1 className="text-[18px] font-semibold text-ink-900">Editar acreditado</h1>

      <AcreditadoForm
        initialData={{
          id: acreditado.id,
          clave: acreditado.clave,
          nombre_completo: acreditado.nombre_completo,
          ciclo: acreditado.ciclo,
          fecha_nacimiento: acreditado.fecha_nacimiento,
          tiempo_residencia: acreditado.tiempo_residencia,
          antiguedad_negocio: acreditado.antiguedad_negocio,
          dependientes: acreditado.dependientes,
          antiguedad_telefono: acreditado.antiguedad_telefono,
          cuenta_banco: acreditado.cuenta_banco,
          casa_habitacion: acreditado.casa_habitacion,
          estado_civil: acreditado.estado_civil,
          negocio_domicilio: acreditado.negocio_domicilio,
          destino_credito: acreditado.destino_credito,
          automovil_propio: acreditado.automovil_propio,
          buro_credito: acreditado.buro_credito,
          tipo_garantia: acreditado.tipo_garantia,
          tipo_negocio: acreditado.tipo_negocio,
          genero: acreditado.genero,
          referencias: refs,
        }}
      />
    </div>
  )
}
