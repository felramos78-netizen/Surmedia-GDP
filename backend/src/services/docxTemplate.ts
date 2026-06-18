// Utilidades compartidas para el renderizado de documentos .docx con
// docxtemplater (variables {{...}}). Centraliza la cláusula de acreditación
// ({{exámenes}}) y la eliminación de párrafos completos cuando una variable
// no aplica.

// Texto literal de la cláusula de acreditación (variable {{exámenes}}).
export const EXAMENES_TEXT =
  'El contrato queda sujeto a los resultados de los exámenes preocupaciones que exige el cliente para el trabajo en terreno y acreditación.'

// Marcador interno: cuando una variable toma este valor, el párrafo (fila /
// viñeta) que la contiene se elimina por completo del documento renderizado.
// Texto ASCII sin caracteres de control para no romper el XML de Word.
export const REMOVE_LINE_SENTINEL = '__SURMEDIA_REMOVE_LINE__'

// Valor de la variable {{exámenes}} según el flag de acreditación del proceso.
// Si está marcada → texto de la cláusula; si no → marcador de eliminación.
export function examenesVar(cd: Record<string, any> | null | undefined): string {
  return cd && cd.acreditacion ? EXAMENES_TEXT : REMOVE_LINE_SENTINEL
}

// Valor de la variable {{beneficios}}: lista separada por comas, o marcador
// de eliminación si no hay ningún beneficio seleccionado.
export function beneficiosVar(arr: string[] | null | undefined): string {
  const list = Array.isArray(arr) ? arr.filter(b => b && b.trim()) : []
  return list.length > 0 ? list.join(', ') : REMOVE_LINE_SENTINEL
}

// Valor de la variable {{tipocontrato}}: "a plazo fijo", "indefinido", etc.
export function tipoContratoVar(type: string | null | undefined): string {
  switch (type) {
    case 'PLAZO_FIJO': return 'a plazo fijo'
    case 'INDEFINIDO': return 'indefinido'
    case 'HONORARIOS': return 'a honorarios'
    case 'PRACTICA':   return 'de práctica'
    default:           return ''
  }
}

function ymd(d: string | Date | null | undefined): [number, number, number] | null {
  if (!d) return null
  const iso = typeof d === 'string' ? d : d.toISOString()
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

// Valor de la variable {{plazocontrato}}: duración entre el ingreso y el término
// del contrato, en meses y/o días (ej: "3 meses", "15 días", "2 meses y 10 días").
// Vacío si no hay fecha de término (contrato indefinido) o si el rango es inválido.
export function plazoContratoVar(start: string | Date | null | undefined, end: string | Date | null | undefined): string {
  const s = ymd(start), e = ymd(end)
  if (!s || !e) return ''
  if (e[0] * 372 + e[1] * 31 + e[2] <= s[0] * 372 + s[1] * 31 + s[2]) return ''
  let months = (e[0] - s[0]) * 12 + (e[1] - s[1])
  let days   = e[2] - s[2]
  if (days < 0) {
    months -= 1
    days += new Date(Date.UTC(e[0], e[1] - 1, 0)).getUTCDate() // días del mes anterior al término
  }
  const parts: string[] = []
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mes' : 'meses'}`)
  if (days > 0)   parts.push(`${days} ${days === 1 ? 'día' : 'días'}`)
  return parts.length ? `de ${parts.join(' y ')}` : ''
}

// Elimina del XML de Word los párrafos (<w:p>…</w:p>) que contengan el
// marcador de eliminación. Recibe el zip de PizZip que devuelve docxtemplater.
export function stripRemovedParagraphs(zip: any): void {
  const file = zip?.file?.('word/document.xml')
  if (!file) return
  let xml: string = file.asText()
  if (!xml.includes(REMOVE_LINE_SENTINEL)) return
  xml = xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (p: string) =>
    p.includes(REMOVE_LINE_SENTINEL) ? '' : p
  )
  zip.file('word/document.xml', xml)
}

// Quita el marcador de cualquier texto plano (p. ej. el nombre del archivo).
export function stripSentinel(s: string): string {
  return s.split(REMOVE_LINE_SENTINEL).join('')
}

// Convierte HTML (editado por el usuario) a un buffer .docx. Se usa al enviar
// un correo cuyo adjunto fue editado manualmente en una versión del hito.
export async function htmlToDocxBuffer(html: string): Promise<Buffer> {
  const htmlToDocx = require('html-to-docx')
  const full = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${html ?? ''}</body></html>`
  const out = await htmlToDocx(full, undefined, { table: { row: { cantSplit: true } } })
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer)
}
