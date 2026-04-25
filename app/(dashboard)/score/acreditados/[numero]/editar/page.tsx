import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AcreditadoForm from '@/components/score/acreditado-form'
import type { Database } from '@/lib/supabase/types'
import type { Referencia } from '@/lib/scoring/types'

export const metadata = { title: 'Editar acreditado — Score Crediticio' }

type AcreditadoRow = Database['public']['Tables']['acreditados']['Row'] & {
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

  const { data: raw } = await supabase
    .from('acreditados')
    .select('*, acreditado_referencias(calidad, nombre_referencia)')
    .eq('numero', numeroInt)
    .single()

  if (!raw) notFound()

  const acreditado = raw as unknown as AcreditadoRow
  const refs = (acreditado.acreditado_referencias ?? []) as Referencia[]

  const initialData = {
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
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb */}
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

      <AcreditadoForm initialData={initialData} />
    </div>
  )
}
