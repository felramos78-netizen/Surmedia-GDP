// Lectura de CVs (PDF / Word) y extracción de datos de contacto.
// Todo es heurístico: el resultado se revisa en la UI antes de guardarse.
import mammoth from 'mammoth'
import { fold } from '../utils/text'
import { normalizeRut } from '../utils/rut'

export interface CvData {
  fullName:    string | null
  email:       string | null
  phone:       string | null
  rut:         string | null
  linkedinUrl: string | null
}

// ── Texto y enlaces del archivo ───────────────────────────────────────────────

export async function extractCvText(buf: Buffer, ext: string): Promise<{ text: string; links: string[] }> {
  if (ext === '.pdf') {
    const { getDocumentProxy, extractText } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buf))
    try {
      const { text } = await extractText(pdf, { mergePages: true })
      // Los CVs suelen enlazar LinkedIn / email como hipervínculo sin mostrar la URL
      const links: string[] = []
      for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
        const page = await pdf.getPage(i)
        for (const a of await page.getAnnotations()) if (a.url) links.push(a.url)
      }
      return { text, links }
    } finally {
      await pdf.cleanup?.()
      await pdf.loadingTask?.destroy?.()
    }
  }
  if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ buffer: buf })
    const html = (await mammoth.convertToHtml({ buffer: buf })).value
    const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1])
    return { text: value, links }
  }
  return { text: '', links: [] }
}

// ── Campos ────────────────────────────────────────────────────────────────────

const EMAIL_RE    = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%áéíóúñ]+)/i
const PHONE_RE    = /(?:\+?\s?56[\s.-]*)?\(?0?9\)?[\s.-]*\d{4}[\s.-]*\d{4}\b/g
const RUT_RE      = /\b(\d{1,2}\.?\d{3}\.?\d{3})\s?-\s?([\dkK])\b/g

function rutDv(body: string): string {
  let sum = 0, mul = 2
  for (let i = body.length - 1; i >= 0; i--) { sum += Number(body[i]) * mul; mul = mul === 7 ? 2 : mul + 1 }
  const r = 11 - (sum % 11)
  return r === 11 ? '0' : r === 10 ? 'K' : String(r)
}

function findRut(text: string): string | null {
  for (const m of text.matchAll(RUT_RE)) {
    const body = m[1].replace(/\./g, '')
    if (rutDv(body) === m[2].toUpperCase()) return normalizeRut(`${body}-${m[2]}`)
  }
  return null
}

function findPhone(text: string): string | null {
  for (const m of text.matchAll(PHONE_RE)) {
    const digits = m[0].replace(/\D/g, '').replace(/^56/, '').replace(/^0/, '')
    if (digits.length === 9 && digits[0] === '9') return `+56 9 ${digits.slice(1, 5)} ${digits.slice(5)}`
  }
  return null
}

/** Slug de LinkedIn sin el texto que el PDF pega al final ("daniel-carrillo-ramaFilmmaker…" → "daniel-carrillo-rama"). */
export function cleanLinkedinUrl(url: string | null | undefined): string | null {
  const m = url?.match(LINKEDIN_RE)
  if (!m) return url ?? null
  let slug = m[1]
  try { slug = decodeURIComponent(slug) } catch {}
  slug = slug.replace(/\/+$/, '').replace(/(?<=[a-z0-9áéíóúñ])[A-Z].*$/, '')
  return `https://www.linkedin.com/in/${slug.toLowerCase()}`
}

function findLinkedin(text: string, links: string[]): string | null {
  // Primero los hipervínculos (vienen limpios); en el texto la URL no lleva espacios
  for (const s of [...links, text]) {
    if (s.match(LINKEDIN_RE)) return cleanLinkedinUrl(s)
  }
  return null
}

const TLDS = ['com', 'cl', 'net', 'org', 'es', 'edu', 'gob', 'gov', 'io', 'co', 'ar', 'pe', 'mx', 'us', 'info', 'me', 'uk', 'de', 'br', 've', 'uy', 'py', 'bo', 'ec']

/**
 * Email sin el texto que el PDF pega antes o después:
 * "+56971386441sanchez.paloma273@gmail.comurmeneta" → "sanchez.paloma273@gmail.com".
 */
export function cleanEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  let [local, domain] = raw.toLowerCase().trim().split('@')
  if (!local || !domain) return null
  // Dominio: la última etiqueta se corta en el primer TLD conocido ("comcontacto" → "com")
  const labels = domain.split('.')
  const last = labels.pop()!
  const tld = TLDS.filter(t => last.startsWith(t)).sort((a, b) => b.length - a.length)
    // "com" gana a "co" salvo que la etiqueta sea exactamente "co"
    .find(t => last === t || t.length > 2 || !TLDS.some(o => o.length > t.length && last.startsWith(o))) ?? last
  domain = [...labels, tld].join('.')
  // Local: sin teléfono ni palabras ("contacto", "linkedin"…) pegados al inicio
  for (let i = 0; i < 3; i++) {
    const before = local
    local = local.replace(/^[\d+-]*(contacto|linkedin|correo|email|e-mail|mail|fono|telefono|celular|tel)(?=[a-z0-9+])/, '')
      .replace(/^\+?\d[\d-]{6,}/, '')
    if (local === before) break
  }
  return local && labels.length ? `${local}@${domain}` : null
}

function findEmail(text: string, links: string[]): string | null {
  const fromLinks = links.filter(l => l.startsWith('mailto:')).map(l => l.slice(7).split('?')[0])
  const all = [...fromLinks, ...(text.match(EMAIL_RE) ?? [])]
    .map(e => cleanEmail(e.replace(/^[.]+|[.]+$/g, '')))
    .filter((e): e is string => !!e)
  return all.find(e => !/surmedia\.cl$|example\.|chiletrabajos|laborum/.test(e)) ?? null
}

// ── Nombre ────────────────────────────────────────────────────────────────────

const NOISE = new Set([
  'cv', 'curriculum', 'curr', 'culum', 'vitae', 'curriculo', 'resume', 'hoja', 'de', 'vida', 'actualizado',
  'final', 'vf', 'act', 'nuevo', 'new', 'pdf', 'copia', 'version', 'ver', 'oct', 'nov', 'dic', 'ene', 'feb',
  'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'set', 'postulaci', 'postulacion', 'applicant', 'actual',
])

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase())

/** Palabras del nombre de archivo que parecen parte de un nombre ("4585610_cv_catalina_cort_s1774636261.pdf"). */
export function nameTokensFromFileName(fileName: string): string[] {
  return fold(fileName.replace(/\.[^.]+$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2'))
    .split(' ')
    .map(w => w.replace(/\d+$/, ''))
    .filter(w => w.length > 1 && !/\d/.test(w) && !NOISE.has(w))
}

/** Línea del texto que parece un nombre propio: 2–5 palabras, sin dígitos ni símbolos. */
function isNameLine(line: string): boolean {
  const words = line.trim().split(/\s+/)
  if (words.length < 2 || words.length > 5) return false
  if (/[\d@:/|•·,()]|\.$/.test(line)) return false
  if (/curr[ií]cul|vitae|perfil|resumen|experiencia|datos|contacto|profesional|antecedentes|sobre m|nacionalidad|licenciatura|nombres|capacidad|creaci[oó]n|adapto|profesora?|productor|animador|dise[nñ]o|portafolio|chile|comunica|titulad|corporativ|intern|trabajo|carta|oferta|audiovisual|periodis|formaci[oó]n|educaci[oó]n|habilidades|objetivo|referencias|idiomas|periodista|dise[nñ]ador|realizador|licenciad|ingenier|t[ée]cnico|comunicador|asistente|estudiante/i.test(line)) return false
  return words.every(w => /^\p{L}[\p{L}'.-]*$/u.test(w))
}

function guessName(text: string, fileName: string): string | null {
  const tokens = nameTokensFromFileName(fileName)
  const lines  = text.split(/\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 25)
  const candidates = lines.filter(isNameLine)

  // Preferir una línea del texto que comparta palabras con el nombre del archivo
  if (tokens.length) {
    const scored = candidates
      .map(l => ({ l, hits: fold(l).split(' ').filter(w => tokens.some(t => t.length > 2 && (w.startsWith(t) || t.startsWith(w)))).length }))
      .filter(x => x.hits >= 1)
      .sort((a, b) => b.hits - a.hits)
    if (scored.length) return titleCase(scored[0].l)
    // El texto no confirma el nombre del archivo: el archivo manda si trae nombre y apellido
    if (tokens.length >= 2) return titleCase(tokens.slice(0, 4).join(' '))
  }
  return candidates.length ? titleCase(candidates[0]) : null
}

export function parseCvData(text: string, links: string[], fileName: string): CvData {
  return {
    fullName:    guessName(text, fileName),
    email:       findEmail(text, links),
    phone:       findPhone(text),
    rut:         findRut(text),
    linkedinUrl: findLinkedin(text, links),
  }
}
