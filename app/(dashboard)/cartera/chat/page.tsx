import Header from '@/components/layout/header'
import AssistantChat from '@/components/cartera/assistant-chat'

export default function CarteraChatPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-80px)]"> {/* adjust for outer paddings */}
      <Header
        title="Chat IA — Asistente CrediFlexi"
        subtitle="Resuelve dudas sobre la empresa (cartera, reportes, PAR...) y cómo usar la plataforma mea-tickets. (Demo con conocimiento embebido)"
      />

      <div className="flex-1 min-h-0 px-5 md:px-9 pb-6">
        <AssistantChat />
      </div>
    </div>
  )
}
