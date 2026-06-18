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

// ── Constants for Areas and Categories ───────────────────────────────────────

export const AREAS = ['Personas', 'Administración']

export const CATEGORIES_BY_AREA: Record<string, string[]> = {
  Personas: [
    'Beneficios dotación',
    'Talleres interno',
    'Cultura/integración',
    'Formación/Capacitación',
    'EPPs',
    'Exámenes ocupacionales',
    'Sin clasificar',
  ],
  Administración: [
    'Arriendos',
    'Boleta de garantía',
    'Envíos',
    'Equipos',
    'Gastos bancarios',
    'Gastos oficina',
    'Gastos oficina Antofagasta',
    'Gastos oficina Rancagua',
    'Gastos oficina Santiago',
    'Hospedaje',
    'Movilización',
    'Seguros contratos',
    'Seguros directores',
    'Servicios',
    'Servicios administrativos',
    'Servicios contratos',
    'Servicios financieros',
    'Servicios legales',
    'Servicios oficina',
    'Software',
    'Vehículos',
    'Viajes',
  ],
}
