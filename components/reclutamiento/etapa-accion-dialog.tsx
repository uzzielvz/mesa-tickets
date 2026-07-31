'use client'

import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import ContratacionForm from '@/components/reclutamiento/forms/contratacion-form'
import FinalDgForm from '@/components/reclutamiento/forms/final-dg-form'
import AltaConfigForm from '@/components/reclutamiento/forms/alta-config-form'
import { btnNavy, btnCancelar } from '@/components/reclutamiento/forms/estilos'
import type { SiguientePaso } from '@/lib/reclutamiento/etapas'

// Modal del pipeline: monta el formulario que exige la etapa, o pide confirmación
// cuando el paso es directo pero tiene advertencias.
//
// Los formularios viven aquí y no en la tarjeta porque una columna de 220px no
// da para un grid de 7 correos; y todo lo que manda correo pasa por este modal
// para que ningún click accidental dispare un Meet o una bienvenida.
export default function EtapaAccionDialog({
  abierto,
  onOpenChange,
  candidatoId,
  candidatoNombre,
  paso,
  dgNombre,
  ccDefault,
  destinatariosDefault,
  onHecho,
  onConfirmarDirecta,
}: {
  abierto: boolean
  onOpenChange: (v: boolean) => void
  candidatoId: string
  candidatoNombre: string
  paso: SiguientePaso
  dgNombre: string
  ccDefault: string[]
  destinatariosDefault: Record<string, string>
  /** El formulario terminó: cerrar y recargar el tablero. */
  onHecho: () => void
  /** El usuario aceptó avanzar pese a las advertencias. */
  onConfirmarDirecta?: () => void
}) {
  const form = paso.accion.tipo === 'formulario' ? paso.accion.form : null

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] max-h-[80vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold text-ink-900">{paso.titulo}</DialogTitle>
          <DialogDescription className="text-[12px] text-ink-400">
            {candidatoNombre} — {paso.descripcion}
          </DialogDescription>
        </DialogHeader>

        {paso.advertencias.map(a => (
          <p key={a} className="flex items-start gap-1.5 rounded border border-[#fde68a] bg-[#fffbeb] px-2.5 py-2 text-[12px] text-[#a16207]">
            <AlertTriangle size={13} className="mt-[1px] shrink-0" /> {a}
          </p>
        ))}

        {form === 'final_dg' && (
          <FinalDgForm
            candidatoId={candidatoId}
            dgNombre={dgNombre}
            variante="modal"
            onCancelar={() => onOpenChange(false)}
            onAgendado={onHecho}
          />
        )}

        {form === 'contratacion' && (
          <ContratacionForm
            candidatoId={candidatoId}
            ccDefault={ccDefault}
            variante="modal"
            onCancelar={() => onOpenChange(false)}
            onContratado={onHecho}
          />
        )}

        {form === 'alta_config' && (
          <AltaConfigForm
            candidatoId={candidatoId}
            inicial={null}
            destinatariosDefault={destinatariosDefault}
            variante="modal"
            onGuardado={onHecho}
          />
        )}

        {form === null && (
          <div className="flex items-center gap-2">
            <button onClick={onConfirmarDirecta} className={btnNavy}>
              Continuar de todos modos
            </button>
            <button onClick={() => onOpenChange(false)} className={btnCancelar}>
              Cancelar
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
