import type { LegalEntity } from '@prisma/client'
import { normalizeRut } from '../utils/rut'

// Cliente de solo lectura para la API de BUK. Cada razón social es un tenant
// BUK independiente (URL + key propias), con IDs de colaborador distintos: el
// vínculo con GDP es siempre el RUT.

const BUK_API_PATH = '/api/v1/chile'
const TIMEOUT_MS   = 20_000
const CACHE_TTL_MS = 30 * 60_000   // índice RUT → id BUK
const MIN_REFRESH_MS = 2 * 60_000  // refresco forzado si un RUT no aparece

const TENANTS: Record<LegalEntity, { urlVar: string; keyVar: string }> = {
  COMUNICACIONES_SURMEDIA: { urlVar: 'BUK_URL_COMUNICACIONES', keyVar: 'BUK_API_KEY_COMUNICACIONES' },
  SURMEDIA_CONSULTORIA:    { urlVar: 'BUK_URL_CONSULTORIA',    keyVar: 'BUK_API_KEY_CONSULTORIA' },
}

export const BUK_ENTITIES = Object.keys(TENANTS) as LegalEntity[]

export interface BukEmployeeRef {
  id:       number
  rut:      string
  fullName: string
  status:   string
}

export interface BukFile {
  fileId:    number
  filename:  string
  folder:    string
  createdAt: string | null  // ISO
}

function tenant(entity: LegalEntity) {
  const cfg  = TENANTS[entity]
  const base = process.env[cfg.urlVar]
  const key  = process.env[cfg.keyVar]
  if (!base || !key) throw new Error(`Faltan ${cfg.urlVar}/${cfg.keyVar} en backend/.env`)
  return { base: base.replace(/\/$/, '') + BUK_API_PATH, key }
}

const MAX_RETRIES = 3

async function bukFetch(entity: LegalEntity, path: string, init: { redirect?: 'follow' | 'manual' } = {}, attempt = 1): Promise<Response> {
  const { base, key } = tenant(entity)
  let res: Response
  try {
    res = await fetch(base + path, {
      headers:  { auth_token: key, Accept: 'application/json' },
      redirect: init.redirect ?? 'follow',
      signal:   AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    // Timeout o falla de red: BUK a veces se demora con páginas grandes (/employees ~1 MB)
    if (attempt > MAX_RETRIES) throw err
    await new Promise(r => setTimeout(r, 1000 * 2 ** attempt))
    return bukFetch(entity, path, init, attempt + 1)
  }
  // Rate limit de BUK: reintentar con backoff exponencial
  if (res.status === 429 && attempt <= MAX_RETRIES) {
    await new Promise(r => setTimeout(r, 1000 * 2 ** attempt))
    return bukFetch(entity, path, init, attempt + 1)
  }
  return res
}

// GET JSON de un endpoint BUK (lanza error si no responde 2xx)
export async function bukGetJson<T>(entity: LegalEntity, path: string): Promise<T> {
  const res = await bukFetch(entity, path)
  if (!res.ok) throw new Error(`BUK ${entity} ${path.split('?')[0]} respondió ${res.status}`)
  return res.json() as Promise<T>
}

// Recorre todas las páginas de un endpoint paginado de BUK ({ data, pagination })
export async function bukGetAll<T>(entity: LegalEntity, path: string): Promise<T[]> {
  const out: T[] = []
  const sep = path.includes('?') ? '&' : '?'
  let page = 1, totalPages = 1
  do {
    const body = await bukGetJson<{ data?: T[]; pagination?: { total_pages?: number } }>(entity, `${path}${sep}page_size=100&page=${page}`)
    out.push(...(body.data ?? []))
    totalPages = body.pagination?.total_pages ?? 1
    page++
  } while (page <= totalPages)
  return out
}

// ── Índice RUT → colaborador BUK (cacheado en memoria por razón social) ──────

const indexCache = new Map<LegalEntity, { at: number; byRut: Map<string, BukEmployeeRef[]> }>()
const indexLoading = new Map<LegalEntity, Promise<Map<string, BukEmployeeRef[]>>>()

async function loadIndex(entity: LegalEntity): Promise<Map<string, BukEmployeeRef[]>> {
  const byRut = new Map<string, BukEmployeeRef[]>()
  let page = 1, totalPages = 1
  do {
    const res = await bukFetch(entity, `/employees?page=${page}&page_size=100`)
    if (!res.ok) throw new Error(`BUK ${entity} /employees respondió ${res.status}`)
    const body = await res.json() as {
      data?: { id: number; rut?: string; full_name?: string; status?: string }[]
      pagination?: { total_pages?: number }
    }
    for (const e of body.data ?? []) {
      const rut = normalizeRut(e.rut)
      if (!rut) continue
      const list = byRut.get(rut) ?? []
      list.push({ id: e.id, rut, fullName: e.full_name ?? '', status: e.status ?? '' })
      byRut.set(rut, list)
    }
    totalPages = body.pagination?.total_pages ?? 1
    page++
  } while (page <= totalPages)
  indexCache.set(entity, { at: Date.now(), byRut })
  return byRut
}

async function getIndex(entity: LegalEntity, forceIfOlderThan = CACHE_TTL_MS) {
  const cached = indexCache.get(entity)
  if (cached && Date.now() - cached.at < forceIfOlderThan) return cached.byRut
  // Evita cargas paralelas del mismo índice
  let p = indexLoading.get(entity)
  if (!p) {
    p = loadIndex(entity).finally(() => indexLoading.delete(entity))
    indexLoading.set(entity, p)
  }
  return p
}

// Todas las fichas BUK de una razón social (índice recién consultado)
export async function listBukEmployees(entity: LegalEntity): Promise<BukEmployeeRef[]> {
  return [...(await getIndex(entity, 0)).values()].flat()
}

export async function findBukEmployees(entity: LegalEntity, rawRut: string): Promise<BukEmployeeRef[]> {
  const rut = normalizeRut(rawRut)
  let found = (await getIndex(entity)).get(rut)
  // Colaborador recién creado en BUK: refrescar el índice si no es muy reciente
  if (!found) found = (await getIndex(entity, MIN_REFRESH_MS)).get(rut)
  return found ?? []
}

// ── Documentos ────────────────────────────────────────────────────────────────

// BUK entrega created_at como "DD/MM/YY HH:mm"
function parseBukDate(raw: string | undefined): string | null {
  const m = raw?.match(/^(\d{2})\/(\d{2})\/(\d{2,4})(?:\s+(\d{2}):(\d{2}))?/)
  if (!m) return null
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  return new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 12), Number(m[5] ?? 0))).toISOString()
}

export async function listEmployeeFiles(entity: LegalEntity, bukEmployeeId: number): Promise<BukFile[]> {
  const res = await bukFetch(entity, `/employees/${bukEmployeeId}/docs`)
  if (!res.ok) throw new Error(`BUK ${entity} /employees/${bukEmployeeId}/docs respondió ${res.status}`)
  const body = await res.json() as { employee_files?: { file_id: number; filename: string; path?: string; created_at?: string }[] }
  return (body.employee_files ?? []).map(f => {
    const parts = (f.path ?? '').split('/')
    return {
      fileId:    f.file_id,
      filename:  f.filename,
      folder:    parts.slice(0, -1).join('/'),
      createdAt: parseBukDate(f.created_at),
    }
  })
}

// Devuelve la respuesta de descarga del archivo (BUK redirige a una URL S3 prefirmada)
export async function fetchEmployeeFile(entity: LegalEntity, bukEmployeeId: number, fileId: number): Promise<Response> {
  const res = await bukFetch(entity, `/employees/${bukEmployeeId}/docs/${fileId}`, { redirect: 'manual' })
  const location = res.headers.get('location')
  if (res.status < 300 || res.status >= 400 || !location) {
    throw new Error(`BUK ${entity} no entregó el archivo ${fileId} (status ${res.status})`)
  }
  const file = await fetch(location, { signal: AbortSignal.timeout(60_000) })
  if (!file.ok || !file.body) throw new Error(`Descarga del archivo ${fileId} falló (status ${file.status})`)
  return file
}
