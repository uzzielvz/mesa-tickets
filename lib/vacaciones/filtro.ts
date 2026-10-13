/**
 * El filtro de la lista de personal de /vacaciones, el mismo que usa el Excel
 * de la base (VAC-008): lo que se ve en pantalla es lo que se descarga.
 */

import { nombreClave } from './calendario'
import type { SaldoEmpleado, VerPersonal } from './tipos'

export function filtrarPersonal(todos: SaldoEmpleado[], ver: VerPersonal, q: string): SaldoEmpleado[] {
  const clave = nombreClave(q)
  return (ver === 'inactivos' ? todos.filter(e => !e.activo) : todos.filter(e => e.activo))
    .filter(e => ver !== 'pendientes' || e.restantes_total > 0)
    .filter(e => !clave || nombreClave(e.nombre).includes(clave) || nombreClave(e.puesto ?? '').includes(clave))
}

export function describirFiltro(ver: VerPersonal, q: string): string {
  const base = ver === 'inactivos' ? 'Personal inactivo'
    : ver === 'pendientes' ? 'Personal activo con días por tomar' : 'Personal activo'
  return q.trim() ? `${base} · búsqueda "${q.trim()}"` : base
}
