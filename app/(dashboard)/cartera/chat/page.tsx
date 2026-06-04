import Header from '@/components/layout/header'
import AssistantChat from '@/components/cartera/assistant-chat'

export default function CarteraChatPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <Header
        title="Asistente CrediFlexi"
        subtitle="Dudas sobre la empresa (cartera, PAR, reportes) y cómo usar la plataforma."
        action={
          <span className="text-[10px] px-2 py-0.5 rounded bg-orange/10 text-orange-dark border border-orange/20 font-medium">
            MODO DEMO
          </span>
        }
      />

      <div className="flex-1 min-h-0 px-5 md:px-9 pb-6">
        <AssistantChat />
      </div>
    </div>
  )
}
