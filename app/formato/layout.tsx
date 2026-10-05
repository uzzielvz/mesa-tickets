import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Documentos para imprimir. Van fuera del layout del dashboard a propósito: el
 * menú lateral no debe salir en la hoja. Por ahora solo hay formatos de
 * vacaciones, así que la guarda es la de Gente y Cultura.
 */
export default async function FormatoLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: puede } = await supabase.rpc('has_vacaciones_rh', {})
  if (puede !== true) redirect('/dashboard')

  return <div className="min-h-screen bg-[#F4F4F2] print:bg-white">{children}</div>
}
