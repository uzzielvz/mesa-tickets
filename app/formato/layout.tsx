import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Documentos para imprimir. Van fuera del layout del dashboard a propósito: el
 * menú lateral no debe salir en la hoja.
 *
 * Aquí solo se exige sesión. Quién puede ver cada formato (Gente y Cultura, la
 * persona o su jefe) lo valida `vac_formato` en la base (VAC-005).
 */
export default async function FormatoLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <div className="min-h-screen bg-[#F4F4F2] print:bg-white">{children}</div>
}
