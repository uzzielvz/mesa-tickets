import Link from 'next/link'
import { FileSpreadsheet } from 'lucide-react'
import Header from '@/components/layout/header'
import ImportarBase from '@/components/vacaciones/importar-form'

/** La guarda de Gente y Cultura la pone el layout del módulo. */
export default function ImportarVacacionesPage() {
  return (
    <div>
      <Header
        title="Importar base de vacaciones"
        subtitle="Se hace una vez para arrancar. Volver a importar actualiza a las mismas personas, sin duplicar."
        action={
          <Link href="/vacaciones" className="text-[13px] text-navy hover:underline font-medium">
            Volver
          </Link>
        }
      />
      <div className="px-5 md:px-9 pb-12 flex flex-col gap-6">
        <ImportarBase />

        <div className="border border-[#ECECEC] rounded-md bg-white p-4 max-w-2xl">
          <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink-900">
            <FileSpreadsheet size={15} className="text-ink-400" /> Qué se toma del archivo y qué no
          </p>
          <ul className="mt-2 text-[12.5px] text-ink-500 flex flex-col gap-1 list-disc pl-4">
            <li>
              <strong className="text-ink-700">Se toma:</strong> nombre, puesto, fecha de ingreso, días tomados
              de cada ciclo con sus fechas, y días flotantes.
            </li>
            <li>
              <strong className="text-ink-700">No se toma:</strong> antigüedad, días de derecho y restantes. Esas
              columnas son fórmulas con <span className="font-mono text-[11.5px]">HOY()</span>, que se quedan
              con la fecha del día en que se guardó el archivo. Aquí se calculan con la fecha real y la tabla
              del Art. 76 de la LFT.
            </li>
            <li>
              Una persona que aparece en varias hojas se cuenta <strong className="text-ink-700">una vez</strong>.
              Si está en una sola hoja, igual se le calculan todos sus periodos desde su fecha de ingreso.
            </li>
            <li>
              Al volver a importar, los días que venían del Excel se reemplazan por los del archivo nuevo. Lo
              que se registró en la plataforma no se toca: ni los registros, ni el correo, el jefe, el área o
              el número de empleado.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
