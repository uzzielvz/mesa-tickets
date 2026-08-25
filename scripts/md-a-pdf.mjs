// Convierte un documento Markdown del repo a PDF, con el estilo de CrediFlexi.
//
//   node scripts/md-a-pdf.mjs docs/reclutamiento/manual-usuario.md
//   node scripts/md-a-pdf.mjs docs/reclutamiento/*.md
//
// Por qué existe: el manual y el runbook se comparten con gente que no abre el
// repo. La alternativa era mantener una copia .html de cada documento, que es
// exactamente como una documentación se desfasa. Aquí el .md sigue siendo la
// única fuente y el PDF es un artefacto que se regenera.
//
// Depende de: micromark + micromark-extension-gfm (ya presentes en el árbol de
// dependencias) y de Chrome instalado, para imprimir. Sin dependencias nuevas.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'

// Rutas típicas de Chrome en Windows. Se puede forzar con CHROME_PATH.
const CHROME_CANDIDATOS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)

function buscarChrome() {
  const encontrado = CHROME_CANDIDATOS.find(p => existsSync(p))
  if (!encontrado) {
    throw new Error(
      'No se encontró Chrome ni Edge. Instala Chrome o define CHROME_PATH con la ruta al ejecutable.',
    )
  }
  return encontrado
}

// Mismo criterio de anclas que GitHub, para que el índice del documento siga
// funcionando como enlaces internos dentro del PDF.
function slug(texto) {
  return texto
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

function conAnclas(html) {
  return html.replace(/<h([1-4])>(.*?)<\/h\1>/gs, (_, nivel, contenido) => {
    const texto = contenido.replace(/<[^>]+>/g, '')
    return `<h${nivel} id="${slug(texto)}">${contenido}</h${nivel}>`
  })
}

// Los enlaces a otros .md del repo no llevan a ningún lado dentro de un PDF:
// se dejan como texto para no prometer un clic que no funciona.
function neutralizarEnlacesLocales(html) {
  return html.replace(
    /<a href="\.\/([^"]+\.(?:md|html))">(.*?)<\/a>/gs,
    (_, archivo, texto) => `<span class="ref">${texto}</span>`,
  )
}

// El HTML intermedio vive en una carpeta temporal, así que una ruta relativa
// como ./img/foo.png no resolvería. Se reescriben contra la carpeta del .md
// original. Sin esto, agregar capturas al manual produce un PDF con huecos.
function resolverImagenes(html, dirBase) {
  return html.replace(/<img([^>]*?)src="([^"]+)"/g, (completo, attrs, src) => {
    if (/^(https?:|data:|file:)/.test(src)) return completo
    const abs = resolve(dirBase, src).replace(/\\/g, '/')
    if (!existsSync(abs)) {
      console.warn(`  ⚠ imagen no encontrada: ${src}`)
    }
    return `<img${attrs}src="file:///${abs}"`
  })
}

const CSS = `
  @page { size: A4; margin: 17mm 15mm 16mm 15mm; }

  :root {
    --azul: #1d4ed8; --teal: #0d9488; --tinta: #0f172a;
    --gris: #334155; --gris-claro: #64748b; --linea: #e2e8f0;
    --bg-suave: #f8fafc; --rojo: #b91c1c; --ambar: #92400e;
  }

  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", -apple-system, Helvetica, Arial, sans-serif;
    font-size: 10pt; line-height: 1.5; color: var(--gris);
    margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  h1, h2, h3, h4 { color: var(--tinta); line-height: 1.2; font-weight: 700; break-after: avoid; }
  h1 { font-size: 20pt; letter-spacing: -0.02em; margin: 0 0 0.3em; }
  h2 {
    font-size: 14pt; margin: 1.5em 0 0.5em; padding-top: 0.45em;
    border-top: 2px solid var(--linea); break-before: auto;
  }
  h3 { font-size: 11.5pt; color: var(--azul); margin: 1.2em 0 0.35em; }
  h4 { font-size: 10pt; margin: 1em 0 0.3em; }
  p { margin: 0 0 0.6em; }
  strong { color: var(--tinta); font-weight: 600; }
  a { color: var(--azul); text-decoration: none; }
  .ref { color: var(--tinta); font-weight: 600; }

  ul { margin: 0 0 0.7em; padding-left: 1.25em; }
  /* 1.9em porque con menos, los índices de dos dígitos se cortan en el margen. */
  ol { margin: 0 0 0.7em; padding-left: 1.9em; }
  li { margin-bottom: 0.28em; }
  li::marker { color: var(--azul); }
  input[type="checkbox"] { margin-right: 0.35em; }

  table {
    width: 100%; border-collapse: collapse; font-size: 8.8pt;
    margin: 0.5em 0 1em; break-inside: auto;
  }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th {
    background: var(--tinta); color: #fff; font-weight: 600;
    text-align: left; padding: 0.45em 0.6em;
  }
  td { padding: 0.42em 0.6em; border-bottom: 1px solid var(--linea); vertical-align: top; }
  tbody tr:nth-child(even) td { background: var(--bg-suave); }

  blockquote {
    margin: 0.7em 0; padding: 0.6em 0.9em;
    background: #eff6ff; border-left: 3px solid var(--azul);
    border-radius: 0 4px 4px 0; font-size: 9.2pt; break-inside: avoid;
  }
  blockquote p:last-child { margin-bottom: 0; }

  code {
    font-family: Consolas, "Courier New", monospace; font-size: 0.86em;
    background: var(--bg-suave); border: 1px solid var(--linea);
    border-radius: 3px; padding: 0.08em 0.3em; color: var(--tinta);
  }
  pre {
    background: var(--bg-suave); border: 1px solid var(--linea);
    border-radius: 5px; padding: 0.7em 0.9em; overflow-x: auto;
    font-size: 8.6pt; break-inside: avoid;
  }
  pre code { background: none; border: none; padding: 0; }

  hr { border: none; border-top: 1px solid var(--linea); margin: 1.4em 0; }

  /* Capturas de pantalla: encuadradas y sin partirse entre páginas. */
  img {
    max-width: 100%; height: auto; display: block;
    margin: 0.7em auto; border: 1px solid var(--linea);
    border-radius: 5px; break-inside: avoid;
  }
  /* Un párrafo con solo una imagen en cursiva debajo = pie de figura. */
  img + em, p > img + br + em {
    display: block; text-align: center; font-size: 8.5pt;
    color: var(--gris-claro); margin-top: -0.3em;
  }

  .portada {
    border-bottom: 3px solid var(--azul); padding-bottom: 0.8em; margin-bottom: 1.4em;
  }
  .portada .marca {
    font-size: 7.5pt; font-weight: 700; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--gris-claro); margin-bottom: 0.5em;
  }
  .portada .pie { font-size: 8pt; color: var(--gris-claro); margin-top: 0.5em; }
  .portada h1 { margin: 0; }
`

function envolver(cuerpo, titulo) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" />
<title>${titulo}</title>
<style>${CSS}</style>
</head><body>
<div class="portada">
  <div class="marca">Financiera CrediFlexi &middot; Plataforma de Operaciones</div>
  <h1>${titulo}</h1>
  <div class="pie">Generado el ${new Date().toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
  })} desde <code>${titulo.archivo ?? ''}</code></div>
</div>
${cuerpo}
</body></html>`
}

function convertir(rutaMd) {
  const ruta = resolve(rutaMd)
  const md = readFileSync(ruta, 'utf8')

  // El primer "# Título" se vuelve la portada; el resto es el cuerpo.
  const m = md.match(/^#\s+(.+)$/m)
  const titulo = m ? m[1].replace(/[*_`]/g, '').trim() : basename(ruta, '.md')
  const sinTitulo = m ? md.replace(m[0], '') : md

  let html = micromark(sinTitulo, {
    allowDangerousHtml: true,
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  })
  html = resolverImagenes(neutralizarEnlacesLocales(conAnclas(html)), dirname(ruta))

  const doc = envolver(html, titulo).replace(
    '<code></code>',
    `<code>${basename(ruta)}</code>`,
  )

  const tmp = join(tmpdir(), 'md-a-pdf')
  mkdirSync(tmp, { recursive: true })
  const htmlTmp = join(tmp, `${basename(ruta, '.md')}.html`)
  writeFileSync(htmlTmp, doc, 'utf8')

  const salida = join(dirname(ruta), `${basename(ruta, '.md')}.pdf`)
  execFileSync(buscarChrome(), [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    `--print-to-pdf=${salida}`,
    `file:///${htmlTmp.replace(/\\/g, '/')}`,
  ], { stdio: 'pipe' })

  return salida
}

const archivos = process.argv.slice(2)
if (archivos.length === 0) {
  console.error('Uso: node scripts/md-a-pdf.mjs <archivo.md> [otro.md ...]')
  process.exit(1)
}

for (const archivo of archivos) {
  try {
    console.log(`✓ ${convertir(archivo)}`)
  } catch (err) {
    console.error(`✗ ${archivo}: ${err.message}`)
    process.exitCode = 1
  }
}
