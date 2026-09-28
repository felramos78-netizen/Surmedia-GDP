import type { LegalEntity } from '@/types'

export const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
export const fmt = (n: number | null | undefined) =>
  n == null || n === 0 ? <span className="text-gray-300">—</span> : CLP.format(n)
export const fmtN = (n: number | null | undefined) => (n == null || n === 0 ? '—' : CLP.format(n))

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtPeriodo(p: string | null | undefined): string {
  if (!p || p.length < 6) return p ?? '—'
  const MONTHS: Record<string, string> = {
    '01':'Ene','02':'Feb','03':'Mar','04':'Abr','05':'May','06':'Jun',
    '07':'Jul','08':'Ago','09':'Sep','10':'Oct','11':'Nov','12':'Dic',
  }
  return `${MONTHS[p.slice(4)] ?? p.slice(4)} ${p.slice(0, 4)}`
}

export const ENTITY_LABEL: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'Comunicaciones',
  SURMEDIA_CONSULTORIA:    'Consultoría',
}
export const ENTITY_COLOR: Record<LegalEntity, string> = {
  COMUNICACIONES_SURMEDIA: 'bg-brand-100 text-brand-700',
  SURMEDIA_CONSULTORIA:    'bg-violet-100 text-violet-700',
}

export type SmartCategory = 'honorarios' | 'compras'

// ── Honorarios: Tipo y Categoría Surmedia (nivel documento) ──────────────────

export const TIPOS = ['No Reembolsable', 'Reembolsable']

export const CATEGORIAS_SURMEDIA = [
  'Aseo y Servicios',
  'Apoyo Operacional',
  'Cobertura Operacional',
  'Planta Operacional',
  'Reemplazo',
  'Práctica',
  'Asesoría',
  'Operaciones',
  'Sin definir',
]
