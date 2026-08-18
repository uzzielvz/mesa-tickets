'use client'

/**
 * Última red: errores del propio layout raíz, que `app/error.tsx` no puede
 * atrapar porque vive dentro de él.
 *
 * Aquí NO se puede usar Tailwind ni las fuentes: si el layout raíz falló, su
 * `globals.css` y su `<html>` nunca se montaron — por eso este archivo trae sus
 * propias etiquetas html/body y estilos en línea. Es feo a propósito; la
 * alternativa es una pantalla en blanco.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '64px 20px' }}>
          <p style={{
            fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px',
            fontWeight: 500, color: '#F58220', margin: 0,
          }}>
            Algo se rompió
          </p>
          <h1 style={{
            fontSize: 22, fontWeight: 600, color: '#0F1B3D',
            letterSpacing: '-0.4px', lineHeight: 1.2, margin: '12px 0 0',
          }}>
            La plataforma no pudo iniciar
          </h1>
          <p style={{ fontSize: 13, color: '#6B6B6B', margin: '6px 0 0' }}>
            Reintenta en unos segundos. Si sigue igual, avisa a Sistemas con el código.
          </p>

          <button
            onClick={reset}
            style={{
              marginTop: 20, background: '#0F1B3D', color: '#fff', fontSize: 13,
              fontWeight: 500, padding: '9px 16px', border: 0, borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>

          {error.digest && (
            <div style={{
              marginTop: 24, border: '1px solid #ECECEC', borderRadius: 8,
              background: '#FAFAF9', padding: '12px 16px',
            }}>
              <p style={{
                fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.4px',
                fontWeight: 500, color: '#9B9B9B', margin: 0,
              }}>
                Código del error
              </p>
              <p style={{
                fontSize: 13, color: '#111', fontFamily: 'ui-monospace, monospace',
                margin: '4px 0 0', userSelect: 'all', wordBreak: 'break-all',
              }}>
                {error.digest}
              </p>
            </div>
          )}
        </div>
      </body>
    </html>
  )
}
