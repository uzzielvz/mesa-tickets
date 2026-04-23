// Convierte "uzziel.valdez" o email completo en "Uzziel Valdez"
export function formatName(nombreCompleto: string, email: string): string {
  const name = nombreCompleto?.trim() ?? ''
  // Nombre real: tiene espacio y no contiene @
  if (name && !name.includes('@') && name.includes(' ')) return name
  // Derivar del nombre si parece username, o del email
  const username = (name && !name.includes('@')) ? name : email.split('@')[0]
  return username
    .split('.')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

// Formatea timestamps relativos
export function timeAgo(date: string): string {
  const now = new Date()
  const then = new Date(date)
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`

  return then.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
