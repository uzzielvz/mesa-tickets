import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/header'
import ChatInterface from '@/components/cartera/chat-interface'

export default async function ChatPage() {
  const supabase = createClient()

  const { data: uploads } = await supabase
    .from('cartera_uploads')
    .select('fecha_corte')
    .eq('estado', 'procesado')
    .order('fecha_corte', { ascending: false })

  const fechas = Array.from(new Set((uploads ?? []).map(u => u.fecha_corte as string))) as string[]

  return (
    <div>
      <Header
        title="Chat IA"
        subtitle="Consulta tu cartera en lenguaje natural."
      />
      <div className="px-5 md:px-9 pb-6">
        <ChatInterface fechas={fechas} />
      </div>
    </div>
  )
}
