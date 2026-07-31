'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'
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
    <Dialog.Root open={abierto} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-[560px] max-h-[80vh] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-md border border-[#ECECEC] bg-white p-5 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-[14px] font-semibold text-ink-900">{paso.titulo}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[12px] text-ink-400">
                {candidatoNombre} — {paso.descripcion}
              </Dialog.Description>
            </div>
            <Dialog.Close className="shrink-0 rounded p-1 text-ink-400 transition-colors hover:bg-surface-hover hover:text-ink-700">
              <X size={15} />
              <span className="sr-only">Cerrar</span>
            </Dialog.Close>
          </div>

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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
