/** "hace 5 min", "ayer", "13 oct". Puro: lo usan la campana y la página. */
export function haceCuanto(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso)
  const seg = Math.max(0, Math.round((ahora.getTime() - fecha.getTime()) / 1000))
  if (seg < 60) return 'hace un momento'
  const min = Math.floor(seg / 60)
  if (min < 60) return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return horas === 1 ? 'hace 1 hora' : `hace ${horas} horas`

  // Días contados en el calendario de México, no en bloques de 24 horas.
  const dia = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const dias = Math.round(
    (new Date(`${dia(ahora)}T12:00:00Z`).getTime() - new Date(`${dia(fecha)}T12:00:00Z`).getTime()) / 86_400_000,
  )
  if (dias <= 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return fecha.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    ...(dia(fecha).slice(0, 4) !== dia(ahora).slice(0, 4) ? { year: 'numeric' } : {}),
    timeZone: 'America/Mexico_City',
  })
}
