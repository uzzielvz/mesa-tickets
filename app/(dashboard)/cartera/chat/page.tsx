import { redirect } from 'next/navigation'

// El asistente IA dejó de ser una página: ahora vive como widget flotante
// montado en el layout de cartera (components/cartera/assistant-widget.tsx).
// Esta ruta legacy redirige al resumen para no romper enlaces antiguos.
export default function CarteraChatPage() {
  redirect('/cartera')
}
