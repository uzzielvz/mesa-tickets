'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { calcularScore, clasificar } from '@/lib/scoring/modelo'
import { crearAcreditado, actualizarAcreditado } from '@/lib/actions/acreditados'
import type { Referencia } from '@/lib/scoring/types'

// ─── Estilos reutilizables ────────────────────────────────────────────────────

const inputClass =
  'bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-orange focus:ring-[3px] focus:ring-orange/15 transition-all w-full'

const selectClass =
  'bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 outline-none focus:border-orange transition-all w-full'

const errorClass = 'text-[11.5px] text-red-500 mt-1'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface InitialData {
  id: string
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
  referencias: Referencia[]
}

interface Props {
  initialData?: InitialData
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className={errorClass}>{msg}</p>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.4px] font-semibold text-ink-400 mb-3 mt-1">
      {children}
    </p>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[12.5px] font-medium text-ink-700">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

// ─── Opciones ─────────────────────────────────────────────────────────────────

const CALIDAD_OPTS = ['Excelente', 'Buena', 'Regular'] as const

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AcreditadoForm({ initialData }: Props) {
  const router = useRouter()
  const isEdit = !!initialData

  // ── Estado del formulario ─────────────────────────────────────────────────

  const [clave, setClave] = useState(initialData?.clave ?? '')
  const [nombre, setNombre] = useState(initialData?.nombre_completo ?? '')
  const [ciclo, setCiclo] = useState(initialData?.ciclo ?? '')
  const [fechaNac, setFechaNac] = useState(initialData?.fecha_nacimiento ?? '')
  const [residencia, setResidencia] = useState(String(initialData?.tiempo_residencia ?? ''))
  const [antNegocio, setAntNegocio] = useState(String(initialData?.antiguedad_negocio ?? ''))
  const [dependientes, setDependientes] = useState(String(initialData?.dependientes ?? ''))
  const [antTel, setAntTel] = useState(String(initialData?.antiguedad_telefono ?? ''))
  const [banco, setBanco] = useState(String(initialData?.cuenta_banco ?? ''))
  const [casa, setCasa] = useState(initialData?.casa_habitacion ?? '')
  const [estadoCivil, setEstadoCivil] = useState(initialData?.estado_civil ?? '')
  const [negocioDom, setNegocioDom] = useState(initialData?.negocio_domicilio ?? false)
  const [destino, setDestino] = useState(initialData?.destino_credito ?? '')
  const [auto, setAuto] = useState(initialData?.automovil_propio ?? false)
  const [buro, setBuro] = useState(initialData?.buro_credito ?? '')
  const [garantia, setGarantia] = useState(initialData?.tipo_garantia ?? '')
  const [tipoNeg, setTipoNeg] = useState(initialData?.tipo_negocio ?? '')
  const [genero, setGenero] = useState(initialData?.genero ?? '')

  const [refs, setRefs] = useState<Referencia[]>(
    initialData?.referencias?.length ? initialData.referencias : [{ calidad: 'Buena', nombre_referencia: '' }]
  )

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // ── Preview de score en tiempo real ──────────────────────────────────────

  const preview = useMemo(() => {
    if (!fechaNac || !casa || !estadoCivil || !destino || !buro || !garantia || !tipoNeg || !genero) {
      return null
    }
    try {
      const datos = {
        fecha_nacimiento: fechaNac,
        tiempo_residencia: parseFloat(residencia) || 0,
        antiguedad_negocio: parseFloat(antNegocio) || 0,
        dependientes: parseInt(dependientes) || 0,
        antiguedad_telefono: parseFloat(antTel) || 0,
        cuenta_banco: parseFloat(banco) || 0,
        casa_habitacion: casa,
        estado_civil: estadoCivil,
        negocio_domicilio: negocioDom,
        destino_credito: destino,
        automovil_propio: auto,
        buro_credito: buro,
        tipo_garantia: garantia,
        tipo_negocio: tipoNeg,
        genero,
      }
      const refsValidas = refs.filter(r => r.calidad)
      return calcularScore(datos, refsValidas)
    } catch {
      return null
    }
  }, [fechaNac, residencia, antNegocio, dependientes, antTel, banco, casa, estadoCivil, negocioDom, destino, auto, buro, garantia, tipoNeg, genero, refs])

  const clasificacion = preview ? clasificar(preview.puntaje) : null

  // ── Manejo de referencias ─────────────────────────────────────────────────

  function addRef() {
    setRefs(prev => [...prev, { calidad: 'Buena', nombre_referencia: '' }])
  }

  function removeRef(i: number) {
    setRefs(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateRef(i: number, field: keyof Referencia, value: string) {
    setRefs(prev => prev.map((r, idx) =>
      idx === i ? { ...r, [field]: value } : r
    ))
  }

  // ── Validación local ──────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {}

    if (!/^[A-Za-z0-9]{6}$/.test(clave)) errs.clave = 'Exactamente 6 caracteres alfanuméricos'
    if (nombre.trim().length < 2) errs.nombre = 'Mínimo 2 caracteres'
    if (!/^[0-9]{2}$/.test(ciclo)) errs.ciclo = 'Debe ser 2 dígitos, ej. 01'
    if (!fechaNac) errs.fechaNac = 'Requerido'
    if (residencia === '' || isNaN(parseFloat(residencia))) errs.residencia = 'Número requerido'
    if (antNegocio === '' || isNaN(parseFloat(antNegocio))) errs.antNegocio = 'Número requerido'
    if (dependientes === '' || isNaN(parseInt(dependientes))) errs.dependientes = 'Número requerido'
    if (antTel === '' || isNaN(parseFloat(antTel))) errs.antTel = 'Número requerido'
    if (banco === '' || isNaN(parseFloat(banco))) errs.banco = 'Número requerido'
    if (!casa) errs.casa = 'Selecciona una opción'
    if (!estadoCivil) errs.estadoCivil = 'Selecciona una opción'
    if (!destino) errs.destino = 'Selecciona una opción'
    if (!buro) errs.buro = 'Selecciona una opción'
    if (!garantia) errs.garantia = 'Selecciona una opción'
    if (!tipoNeg) errs.tipoNeg = 'Selecciona una opción'
    if (!genero) errs.genero = 'Selecciona una opción'
    if (refs.length === 0) errs.refs = 'Agrega al menos una referencia'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) {
      toast.error('Corrige los errores antes de continuar')
      return
    }

    setLoading(true)

    const payload = {
      clave: clave.trim(),
      nombre_completo: nombre.trim(),
      ciclo: ciclo.trim(),
      fecha_nacimiento: fechaNac,
      tiempo_residencia: parseFloat(residencia),
      antiguedad_negocio: parseFloat(antNegocio),
      dependientes: parseInt(dependientes),
      antiguedad_telefono: parseFloat(antTel),
      cuenta_banco: parseFloat(banco),
      casa_habitacion: casa,
      estado_civil: estadoCivil,
      negocio_domicilio: negocioDom,
      destino_credito: destino,
      automovil_propio: auto,
      buro_credito: buro,
      tipo_garantia: garantia,
      tipo_negocio: tipoNeg,
      genero,
      referencias: refs,
    }

    const result = isEdit
      ? await actualizarAcreditado(initialData!.id, payload)
      : await crearAcreditado(payload)

    if (result.ok) {
      toast.success(isEdit ? 'Registro actualizado' : 'Acreditado registrado')
      if (!isEdit && result.numero) {
        router.push(`/score/acreditados/${result.numero}`)
      } else {
        router.back()
      }
    } else {
      toast.error(result.error ?? 'Error al guardar')
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 lg:flex-row lg:items-start">

      {/* Panel izquierdo — campos */}
      <div className="flex-1 flex flex-col gap-5">

        {/* ── Identificación ─────────────────────────────────────────────── */}
        <div className="border border-[#ECECEC] rounded-md px-5 pt-4 pb-5 flex flex-col gap-4">
          <SectionTitle>Identificación</SectionTitle>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label required>Nombre completo</Label>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Nombre del acreditado"
                className={inputClass}
              />
              <FieldError msg={errors.nombre} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label required>Clave</Label>
              <input
                value={clave}
                onChange={e => setClave(e.target.value.toUpperCase())}
                placeholder="ej. AB1234"
                maxLength={6}
                className={inputClass}
              />
              <FieldError msg={errors.clave} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label required>Ciclo</Label>
              <input
                value={ciclo}
                onChange={e => setCiclo(e.target.value)}
                placeholder="ej. 01"
                maxLength={2}
                className={inputClass}
              />
              <FieldError msg={errors.ciclo} />
            </div>
          </div>
        </div>

        {/* ── Perfil personal ────────────────────────────────────────────── */}
        <div className="border border-[#ECECEC] rounded-md px-5 pt-4 pb-5 flex flex-col gap-4">
          <SectionTitle>Perfil personal</SectionTitle>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label required>Fecha de nacimiento</Label>
              <input
                type="date"
                value={fechaNac}
                onChange={e => setFechaNac(e.target.value)}
                className={inputClass}
              />
              <FieldError msg={errors.fechaNac} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label required>Estado civil</Label>
              <select value={estadoCivil} onChange={e => setEstadoCivil(e.target.value)} className={selectClass}>
                <option value="">Selecciona...</option>
                {['Casado', 'Union libre', 'Viudo', 'Soltero', 'Divorciado'].map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <FieldError msg={errors.estadoCivil} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label required>Género</Label>
              <select value={genero} onChange={e => setGenero(e.target.value)} className={selectClass}>
                <option value="">Selecciona...</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
              </select>
              <FieldError msg={errors.genero} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label required>Dependientes económicos</Label>
              <input
                type="number"
                min={0}
                value={dependientes}
                onChange={e => setDependientes(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
              <FieldError msg={errors.dependientes} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label required>Casa habitación</Label>
              <select value={casa} onChange={e => setCasa(e.target.value)} className={selectClass}>
                <option value="">Selecciona...</option>
                <option value="Propia">Propia</option>
                <option value="Familiar">Familiar</option>
                <option value="Rentada">Rentada</option>
              </select>
              <FieldError msg={errors.casa} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label required>Tiempo de residencia (años)</Label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={residencia}
                onChange={e => setResidencia(e.target.value)}
                placeholder="ej. 3.5"
                className={inputClass}
              />
              <FieldError msg={errors.residencia} />
            </div>
          </div>
        </div>

        {/* ── Negocio ────────────────────────────────────────────────────── */}
        <div className="border border-[#ECECEC] rounded-md px-5 pt-4 pb-5 flex flex-col gap-4">
          <SectionTitle>Negocio</SectionTitle>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label required>Tipo de negocio</Label>
              <select value={tipoNeg} onChange={e => setTipoNeg(e.target.value)} className={selectClass}>
                <option value="">Selecciona...</option>
                <option value="Fijo">Fijo</option>
                <option value="Semifijo">Semifijo</option>
              </select>
              <FieldError msg={errors.tipoNeg} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label required>Antigüedad del negocio (años)</Label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={antNegocio}
                onChange={e => setAntNegocio(e.target.value)}
                placeholder="ej. 2"
                className={inputClass}
              />
              <FieldError msg={errors.antNegocio} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label required>Destino del crédito</Label>
              <select value={destino} onChange={e => setDestino(e.target.value)} className={selectClass}>
                <option value="">Selecciona...</option>
                <option value="Capital de trabajo">Capital de trabajo</option>
                <option value="Activo fijo">Activo fijo</option>
                <option value="Bienes y servicios de consumo">Bienes y servicios de consumo</option>
              </select>
              <FieldError msg={errors.destino} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label required>Tipo de garantía</Label>
              <select value={garantia} onChange={e => setGarantia(e.target.value)} className={selectClass}>
                <option value="">Selecciona...</option>
                <option value="Equipo de transporte">Equipo de transporte</option>
                <option value="Ninguna">Ninguna</option>
                <option value="Avales">Avales</option>
              </select>
              <FieldError msg={errors.garantia} />
            </div>

            {/* Toggles booleanos */}
            <div className="flex items-center justify-between border border-[#ECECEC] rounded px-3 py-2.5">
              <Label>Negocio en domicilio</Label>
              <button
                type="button"
                onClick={() => setNegocioDom(v => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors ${negocioDom ? 'bg-orange' : 'bg-[#D1D5DB]'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${negocioDom ? 'translate-x-4' : ''}`} />
              </button>
            </div>

            <div className="flex items-center justify-between border border-[#ECECEC] rounded px-3 py-2.5">
              <Label>Automóvil propio</Label>
              <button
                type="button"
                onClick={() => setAuto(v => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors ${auto ? 'bg-orange' : 'bg-[#D1D5DB]'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${auto ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Financiero ─────────────────────────────────────────────────── */}
        <div className="border border-[#ECECEC] rounded-md px-5 pt-4 pb-5 flex flex-col gap-4">
          <SectionTitle>Financiero</SectionTitle>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label required>Buró de crédito</Label>
              <select value={buro} onChange={e => setBuro(e.target.value)} className={selectClass}>
                <option value="">Selecciona...</option>
                <option value="Excelente">Excelente</option>
                <option value="Buena">Buena</option>
                <option value="Regular">Regular</option>
              </select>
              <FieldError msg={errors.buro} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label required>Antigüedad cuenta bancaria (años)</Label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={banco}
                onChange={e => setBanco(e.target.value)}
                placeholder="ej. 2"
                className={inputClass}
              />
              <FieldError msg={errors.banco} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label required>Antigüedad telefónica (años)</Label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={antTel}
                onChange={e => setAntTel(e.target.value)}
                placeholder="ej. 1.5"
                className={inputClass}
              />
              <FieldError msg={errors.antTel} />
            </div>
          </div>
        </div>

        {/* ── Referencias ───────────────────────────────────────────────── */}
        <div className="border border-[#ECECEC] rounded-md px-5 pt-4 pb-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Referencias personales</SectionTitle>
            <button
              type="button"
              onClick={addRef}
              className="flex items-center gap-1 text-[12px] text-orange hover:text-orange-dark font-medium transition-colors"
            >
              <Plus size={13} />
              Agregar
            </button>
          </div>

          {refs.length === 0 && (
            <p className="text-[12.5px] text-ink-400">Sin referencias. Agrega al menos una.</p>
          )}

          <div className="flex flex-col gap-2">
            {refs.map((ref, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={ref.nombre_referencia ?? ''}
                  onChange={e => updateRef(i, 'nombre_referencia', e.target.value)}
                  placeholder={`Referencia ${i + 1}`}
                  className={`${inputClass} flex-1`}
                />
                <select
                  value={ref.calidad}
                  onChange={e => updateRef(i, 'calidad', e.target.value)}
                  className="bg-white border border-[#ECECEC] rounded px-3 py-[7px] text-[13px] text-ink-900 outline-none focus:border-orange transition-all"
                >
                  {CALIDAD_OPTS.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
                {refs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRef(i)}
                    className="text-ink-300 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <FieldError msg={errors.refs} />
        </div>

        {/* ── Botones ───────────────────────────────────────────────────── */}
        <div className="flex gap-2 pb-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-orange hover:bg-orange-dark text-white text-[12.5px] font-medium rounded px-5 py-[8px] transition-colors disabled:opacity-50"
          >
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Registrar acreditado'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={loading}
            className="border border-[#ECECEC] text-ink-700 text-[12.5px] font-medium rounded px-5 py-[8px] hover:bg-surface-hover transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Panel derecho — preview score */}
      <div className="w-full lg:w-[280px] flex-shrink-0 flex flex-col gap-3 sticky top-6">
        <p className="text-[11px] uppercase tracking-[0.4px] font-semibold text-ink-400">
          Preview del score
        </p>

        {preview && clasificacion ? (
          <div className="border border-[#ECECEC] rounded-md px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-end gap-2">
                <span className="text-[40px] font-semibold text-navy leading-none tracking-tight">
                  {preview.puntaje.toFixed(1)}
                </span>
                <span className="text-[13px] text-ink-400 mb-1">/ 100</span>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md ${clasificacion.bg}`}>
                <span className={`text-[22px] font-bold ${clasificacion.color}`}>{clasificacion.letra}</span>
                <span className={`text-[11px] font-medium ${clasificacion.color}`}>{clasificacion.label}</span>
              </div>
            </div>

            <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(preview.puntaje, 100)}%`,
                  backgroundColor:
                    clasificacion.letra === 'A' ? '#15803d' :
                    clasificacion.letra === 'B' ? '#a16207' :
                    clasificacion.letra === 'C' ? '#c2410c' : '#b91c1c',
                }}
              />
            </div>

            {/* Variables rápidas */}
            <div className="flex flex-col gap-1 pt-1">
              {preview.desglose.map(d => (
                <div key={d.variable} className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] text-ink-500 truncate">{d.variable}</span>
                  <span className="text-[11.5px] font-medium text-navy shrink-0">
                    {d.puntos.toFixed(1)}/{d.maximo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="border border-[#ECECEC] rounded-md px-5 py-6 text-center">
            <p className="text-[12.5px] text-ink-400 leading-relaxed">
              Completa los campos requeridos para ver el score estimado.
            </p>
          </div>
        )}
      </div>
    </form>
  )
}
