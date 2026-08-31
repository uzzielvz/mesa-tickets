import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guarda de módulo. Los reportes traen la CLABE, el nombre y los montos de cada
 * fondeador, así que no basta con que la RLS rechace la consulta: quien no tiene
 * ninguno de los tres papeles no debe ni ver la pantalla armarse.
 *
 * Aquí solo se comprueba la pertenencia al módulo. Cada puerta —pagos y
 * desempeño— vuelve a comprobar la suya en su propio layout, porque tener acceso
 * a una no da acceso a la otra.
 */
export default async function InversionesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol, acceso_inversiones_carga, acceso_inversiones_pagos, acceso_inversiones_desempeno')
    .eq('id', user.id)
    .single()

  const p = profile as Record<string, unknown> | null
  const puede = p?.rol === 'admin' ||
    p?.acceso_inversiones_carga === true ||
    p?.acceso_inversiones_pagos === true ||
    p?.acceso_inversiones_desempeno === true

  if (!puede) redirect('/dashboard')

  return <>{children}</>
}
