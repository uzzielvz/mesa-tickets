// El formato GYC (vacaciones o días flotantes) como PDF descargable (VAC-008).
// Solo servidor. Misma información que /formato/vacaciones/[id]: los dos salen
// de `camposFormato`.
//
//   · Si los días vienen de una solicitud: CONSTANCIA de tres firmas
//     electrónicas. Cada firma lleva el nombre de quien firmó trazado como
//     firma, el nombre impreso, el cargo y la fecha y hora. Abajo, el QR y el
//     código que confirman el documento en /verificar/<código>.
//   · Si RH registró los días a mano: el formato de siempre, con las líneas en
//     blanco para firmar en papel.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import QRCode from 'qrcode'
import { FIRMA_TTF_BASE64, LOGO_PNG_BASE64 } from './recursos'
import { camposFormato, codigoLegible, momentoFirma, type CamposFormato } from './formato'
import { ajustar, ansi, envolver } from './pdf-util'
import type { DatosFormato } from './tipos'

const NAVY = rgb(15 / 255, 27 / 255, 61 / 255)
const TINTA = rgb(0.07, 0.07, 0.07)
const GRIS = rgb(0.42, 0.42, 0.42)
const VERDE = rgb(46 / 255, 125 / 255, 50 / 255)
const VERDE_FONDO = rgb(241 / 255, 248 / 255, 242 / 255)
const LINEA = rgb(0.1, 0.1, 0.1)

// Carta, en puntos.
const ANCHO = 612
const ALTO = 792
const X0 = 36
const X1 = ANCHO - 36

interface Fuentes {
  normal: PDFFont
  negrita: PDFFont
  firma: PDFFont
}

/** Coordenadas desde ARRIBA de la página (pdf-lib mide desde abajo). */
const y = (desdeArriba: number) => ALTO - desdeArriba

function texto(p: PDFPage, f: PDFFont, t: string, x: number, top: number, size: number, color: RGB = TINTA) {
  p.drawText(ansi(t), { x, y: y(top), size, font: f, color })
}

/** Etiqueta, línea y valor: un renglón del formato. Regresa dónde termina. */
function campo(
  p: PDFPage, fx: Fuentes, etiqueta: string, valor: string | null, x: number, top: number, ancho: number,
) {
  const etq = ansi(etiqueta)
  texto(p, fx.normal, etq, x, top, 8.5)
  const xValor = x + fx.normal.widthOfTextAtSize(etq, 8.5) + 5
  const anchoValor = x + ancho - xValor
  p.drawLine({ start: { x: xValor, y: y(top + 2.5) }, end: { x: x + ancho, y: y(top + 2.5) }, thickness: 0.6, color: LINEA })
  if (valor) {
    const a = ajustar(fx.negrita, ansi(valor), 9, anchoValor - 4)
    p.drawText(a.texto, { x: xValor + 2, y: y(top), size: a.size, font: fx.negrita, color: TINTA })
  }
}

function dibujarFirma(
  p: PDFPage, fx: Fuentes, c: CamposFormato, i: number, x: number, ancho: number, topLinea: number,
) {
  const f = c.firmas[i]
  const centro = (t: string, font: PDFFont, size: number, top: number, color: RGB = TINTA) => {
    const a = ajustar(font, ansi(t), size, ancho)
    const w = font.widthOfTextAtSize(a.texto, a.size)
    p.drawText(a.texto, { x: x + (ancho - w) / 2, y: y(top), size: a.size, font, color })
  }

  if (f.electronica) {
    // La firma: el nombre de quien firmó, trazado, sobre la línea.
    const trazo = ajustar(fx.firma, f.electronica.quien, 26, ancho - 6, 12)
    const w = fx.firma.widthOfTextAtSize(trazo.texto, trazo.size)
    p.drawText(trazo.texto, { x: x + (ancho - w) / 2, y: y(topLinea - 5), size: trazo.size, font: fx.firma, color: NAVY })
  } else if (c.electronico) {
    centro('No aplica: sin jefe asignado', fx.normal, 7.5, topLinea - 6, GRIS)
  }

  p.drawLine({ start: { x, y: y(topLinea) }, end: { x: x + ancho, y: y(topLinea) }, thickness: 0.8, color: LINEA })
  centro(f.nombre ?? '', fx.negrita, 7.5, topLinea + 10)
  centro(f.rol, fx.negrita, 7.5, topLinea + 20)
  if (f.electronica) {
    centro(`Firmado electrónicamente · ${momentoFirma(f.electronica.cuando)} h`, fx.normal, 6.8, topLinea + 30, VERDE)
  }
}

export async function constanciaPdf(datos: DatosFormato, generado: Date = new Date()): Promise<Uint8Array> {
  const c = camposFormato(datos)
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(`${c.titulo} · Folio ${c.folio}`)
  pdf.setSubject(c.electronico ? 'Constancia firmada electrónicamente' : 'Formato para firma autógrafa')
  pdf.setAuthor('Plataforma CrediFlexi')
  pdf.setCreator('Plataforma CrediFlexi')
  pdf.setProducer('Plataforma CrediFlexi')
  pdf.setCreationDate(generado)

  const fx: Fuentes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrita: await pdf.embedFont(StandardFonts.HelveticaBold),
    firma: await pdf.embedFont(Buffer.from(FIRMA_TTF_BASE64, 'base64'), { subset: false }),
  }
  const logo = await pdf.embedPng(Buffer.from(LOGO_PNG_BASE64, 'base64'))
  const p = pdf.addPage([ANCHO, ALTO])
  const interior = X1 - X0 - 24
  const xi = X0 + 12

  // ── Encabezado ──
  let top = 36
  p.drawImage(logo, { x: xi, y: y(top + 46), width: 116, height: 42 })
  const titulo = ansi(c.titulo)
  const wTitulo = fx.negrita.widthOfTextAtSize(titulo, 12)
  p.drawText(titulo, { x: (X0 + X1) / 2 - wTitulo / 2 + 30, y: y(top + 28), size: 12, font: fx.negrita, color: TINTA })
  const folio = `Folio ${c.folio}`
  p.drawText(folio, { x: X1 - 12 - fx.normal.widthOfTextAtSize(folio, 8), y: y(top + 16), size: 8, font: fx.normal, color: GRIS })
  top += 54

  if (c.electronico) {
    p.drawRectangle({ x: X0, y: y(top + 16), width: X1 - X0, height: 18, color: VERDE_FONDO })
    texto(p, fx.negrita, `Firmado electrónicamente en la plataforma de CrediFlexi (solicitud ${c.folioSolicitud}). No requiere firma autógrafa.`,
      xi, top + 11, 8, VERDE)
    top += 20
  }

  // ── Datos ──
  top += 18
  const mitad = interior / 2
  campo(p, fx, 'Nombre de la Empresa:', c.empresa, xi, top, mitad - 12)
  campo(p, fx, 'Área y/o Departamento:', c.area, xi + mitad, top, mitad)
  top += 20
  campo(p, fx, 'No. de Empleado:', c.numeroEmpleado, xi, top, mitad - 12)
  campo(p, fx, 'Nombre del Empleado:', c.nombre, xi + mitad, top, mitad)
  top += 20
  campo(p, fx, 'Fecha de Ingreso:', c.ingreso, xi, top, mitad - 12)
  campo(p, fx, 'Años de Servicio:', `${c.aniosServicio} ${c.aniosServicio === 1 ? 'AÑO' : 'AÑOS'}`, xi + mitad, top, mitad)
  top += 20
  const tercio = interior / 3
  campo(p, fx, 'Días que corresponden:', c.diasCorresponden, xi, top, tercio - 10)
  campo(p, fx, 'Días a disfrutar:', c.diasDisfrutar, xi + tercio, top, tercio - 10)
  campo(p, fx, 'Días Pendientes:', c.diasPendientes, xi + 2 * tercio, top, tercio)
  top += 20
  campo(p, fx, 'Período a Disfrutar:', c.periodo, xi, top, interior)
  top += 22

  texto(p, fx.normal, c.esVacaciones ? 'Días que inician sus vacaciones' : 'Días que inician sus días flotantes', xi, top, 8.5)
  top += 15
  for (const [palabra, f] of [['del', c.inicio], ['al', c.fin]] as const) {
    texto(p, fx.normal, palabra, xi + 120, top, 8.5)
    campo(p, fx, '', String(f.dia), xi + 140, top, 70)
    campo(p, fx, 'de', f.mes, xi + 220, top, 140)
    campo(p, fx, 'del', String(f.anio), xi + 370, top, 90)
    top += 17
  }
  top += 5
  campo(p, fx, 'Fecha en que deberá presentarse a trabajar:', c.regreso, xi, top, interior)
  top += 20

  // Observaciones: hasta dos renglones.
  texto(p, fx.normal, 'Observaciones:', xi, top, 8.5)
  const xObs = xi + fx.normal.widthOfTextAtSize('Observaciones:', 8.5) + 5
  const renglones = c.observaciones ? envolver(fx.negrita, ansi(c.observaciones), 8.5, xi + interior - xObs - 4) : []
  for (let i = 0; i < 2; i++) {
    p.drawLine({ start: { x: i === 0 ? xObs : xi, y: y(top + 2.5) }, end: { x: xi + interior, y: y(top + 2.5) }, thickness: 0.6, color: LINEA })
    let r = renglones[i]
    if (r && i === 1 && renglones.length > 2) r = ajustar(fx.negrita, `${r} ${renglones.slice(2).join(' ')}`, 8.5, interior - 4).texto
    if (r) p.drawText(r, { x: (i === 0 ? xObs : xi) + 2, y: y(top), size: 8.5, font: fx.negrita, color: TINTA })
    top += 15
  }

  // ── Firmas ──
  top += 4
  p.drawLine({ start: { x: X0, y: y(top) }, end: { x: X1, y: y(top) }, thickness: 1.2, color: LINEA })
  top += 14
  if (c.esVacaciones) {
    for (const l of envolver(fx.normal,
      'POR EL PRESENTE EXPRESO MI CONFORMIDAD DE SOLICITAR Y GOZAR MIS VACACIONES DE ACUERDO A LO QUE ESTABLECE EL ARTÍCULO 76 DE LA LEY FEDERAL DEL TRABAJO, CONSIDERANDO LOS SIGUIENTES DATOS:',
      7.6, interior)) {
      texto(p, fx.normal, l, xi, top, 7.6)
      top += 10
    }
  }
  top += 8
  const lugar = `${c.ciudad} a ${c.elaborado.dia} de ${c.elaborado.mes} de ${c.elaborado.anio}`
  const wLugar = fx.negrita.widthOfTextAtSize(ansi(lugar), 9)
  texto(p, fx.negrita, lugar, (X0 + X1) / 2 - wLugar / 2, top, 9)
  top += c.electronico ? 46 : 52

  const anchoFirma = (interior - 2 * 18) / 3
  for (let i = 0; i < 3; i++) dibujarFirma(p, fx, c, i, xi + i * (anchoFirma + 18), anchoFirma, top)
  top += c.electronico ? 40 : 30

  // Marco del formato, como el original.
  p.drawRectangle({ x: X0, y: y(top), width: X1 - X0, height: top - 36, borderColor: LINEA, borderWidth: 1 })

  // ── Verificación ──
  top += 18
  if (c.electronico && c.codigo && c.urlVerificacion) {
    const qr = await pdf.embedPng(await QRCode.toBuffer(c.urlVerificacion, { errorCorrectionLevel: 'M', margin: 1, width: 300 }))
    const lado = 88
    p.drawImage(qr, { x: X0, y: y(top + lado), width: lado, height: lado })
    const xt = X0 + lado + 14
    texto(p, fx.negrita, 'Verifica este documento', xt, top + 12, 9.5, NAVY)
    texto(p, fx.normal, 'Escanea el código o entra a:', xt, top + 26, 8, GRIS)
    texto(p, fx.negrita, c.urlVerificacion.replace(/^https?:\/\//, ''), xt, top + 38, 8, NAVY)
    texto(p, fx.normal, `Código de verificación: ${codigoLegible(c.codigo)}`, xt, top + 52, 8)
    envolver(fx.normal,
      'Cada firma registra quién la dio y cuándo, con su cuenta de la plataforma. Si la solicitud se anula, la verificación lo indica.',
      7.4, X1 - xt,
    ).forEach((l, i) => texto(p, fx.normal, l, xt, top + 66 + i * 10, 7.4, GRIS))
    top += lado + 14
  } else {
    texto(p, fx.normal, 'Registrado por Gente y Cultura: este formato se firma en papel.', X0, top, 8, GRIS)
    top += 14
  }

  const pie = `Generado en la plataforma de CrediFlexi el ${momentoFirma(generado.toISOString())} h · Folio ${c.folio}`
    + (c.folioSolicitud ? ` · Solicitud ${c.folioSolicitud}` : '')
  texto(p, fx.normal, pie, X0, top, 7, GRIS)

  return pdf.save()
}
