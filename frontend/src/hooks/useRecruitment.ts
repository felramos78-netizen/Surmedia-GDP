import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { fold } from '@/lib/utils'

// Reclutamiento: base de CVs. Los archivos viven en la unidad compartida de Drive
// y se abren a través del backend.

export type RecruitmentStage = 'RECIBIDO' | 'EN_REVISION' | 'PRESELECCIONADO' | 'ENTREVISTA' | 'OFERTA' | 'CONTRATADO' | 'DESCARTADO'
export type CandidateSource  = 'PORTAL' | 'DRIVE' | 'GMAIL' | 'REFERIDO' | 'HUNTING' | 'MANUAL'

export const STAGES: RecruitmentStage[] = ['RECIBIDO', 'EN_REVISION', 'PRESELECCIONADO', 'ENTREVISTA', 'OFERTA', 'CONTRATADO', 'DESCARTADO']

export const STAGE_META: Record<RecruitmentStage, { label: string; cls: string }> = {
  RECIBIDO:        { label: 'Recibido',        cls: 'bg-gray-100 text-gray-600' },
  EN_REVISION:     { label: 'En revisión',     cls: 'bg-amber-50 text-amber-700' },
  PRESELECCIONADO: { label: 'Preseleccionado', cls: 'bg-blue-50 text-blue-700' },
  ENTREVISTA:      { label: 'Entrevista',      cls: 'bg-indigo-50 text-indigo-700' },
  OFERTA:          { label: 'Oferta',          cls: 'bg-purple-50 text-purple-700' },
  CONTRATADO:      { label: 'Contratado',      cls: 'bg-emerald-50 text-emerald-700' },
  DESCARTADO:      { label: 'Descartado',      cls: 'bg-red-50 text-red-600' },
}

export const SOURCE_LABEL: Record<CandidateSource, string> = {
  PORTAL: 'Portal de empleo', DRIVE: 'Drive', GMAIL: 'Gmail', REFERIDO: 'Referido', HUNTING: 'Hunting', MANUAL: 'Manual',
}

// ── Perfil del candidato ──────────────────────────────────────────────────────

export interface CandidateProfile {
  professionalTitle: string | null
  institution:       string | null
  city:              string | null
  yearsExperience:   number | null
  lastEmployer:      string | null
  lastPosition:      string | null
  sector:            string | null
  skills:            string | null
  tools:             string | null
  certifications:    string | null
  availability:      string | null
}

export type ProfileField = keyof CandidateProfile

export const PROFILE_FIELDS: { key: ProfileField; label: string; numeric?: boolean; long?: boolean }[] = [
  { key: 'professionalTitle', label: 'Título profesional' },
  { key: 'institution',       label: 'Universidad / instituto' },
  { key: 'city',              label: 'Ciudad' },
  { key: 'yearsExperience',   label: 'Años de experiencia', numeric: true },
  { key: 'lastEmployer',      label: 'Último lugar de trabajo' },
  { key: 'lastPosition',      label: 'Último cargo' },
  { key: 'sector',            label: 'Sector / rubro' },
  { key: 'skills',            label: 'Competencias', long: true },
  { key: 'tools',             label: 'Herramientas', long: true },
  { key: 'certifications',    label: 'Certificaciones' },
  { key: 'availability',      label: 'Disponibilidad' },
]

export interface JobOpening {
  id:          string
  name:        string
  driveFolder: string | null
  city:        string | null
  status:      'ABIERTA' | 'CERRADA'
  notes:       string | null
  byStage:     Record<RecruitmentStage, number>
  active:      number
  archived:    number
}

export interface CandidateListItem extends CandidateProfile {
  id:           string
  fullName:     string
  email:        string | null
  phone:        string | null
  linkedinUrl:  string | null
  source:       CandidateSource
  createdAt:    string
  applications: { id: string; stage: RecruitmentStage; isArchived: boolean; jobOpening: { id: string; name: string } }[]
  _count:       { files: number }
  aiSuggestedAt: string | null
}

export interface CandidateFile {
  id:         string
  fileName:   string
  drivePath:  string
  sizeBytes:  number
  modifiedAt: string | null
  removedAt:  string | null
  jobOpeningId: string | null
}

export interface CandidateApplication {
  id:         string
  stage:      RecruitmentStage
  isArchived: boolean
  notes:      string | null
  createdAt:  string
  jobOpening: { id: string; name: string; city: string | null }
}

export interface Candidate extends CandidateProfile {
  id:           string
  fullName:     string
  email:        string | null
  phone:        string | null
  rut:          string | null
  linkedinUrl:  string | null
  source:       CandidateSource
  referredBy:   string | null
  notes:        string | null
  createdAt:    string
  applications: CandidateApplication[]
  files:        CandidateFile[]
}

export interface CandidateFilters {
  q?:         string
  openingId?: string
  stage?:     string
  source?:    string
  archived?:  '' | 'current' | 'only'
}

// ── Vacantes y candidatos ─────────────────────────────────────────────────────

export function useJobOpenings() {
  return useQuery({
    queryKey: ['recruitment', 'openings'],
    queryFn: async () => (await api.get<JobOpening[]>('/recruitment/openings')).data,
  })
}

export function useUpdateJobOpening() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; city?: string | null; status?: 'ABIERTA' | 'CERRADA' }) =>
      (await api.patch(`/recruitment/openings/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recruitment'] }),
  })
}

export function useCandidates(filters: CandidateFilters) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  return useQuery({
    queryKey: ['recruitment', 'candidates', params],
    queryFn: async () => (await api.get<CandidateListItem[]>('/recruitment/candidates', { params })).data,
    placeholderData: prev => prev,
  })
}

export function useCandidate(id: string | null) {
  return useQuery({
    queryKey: ['recruitment', 'candidate', id],
    queryFn: async () => (await api.get<Candidate>(`/recruitment/candidates/${id}`)).data,
    enabled: !!id,
  })
}

export function useUpdateCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Partial<Record<'fullName' | 'email' | 'phone' | 'rut' | 'linkedinUrl' | 'referredBy' | 'notes' | 'source' | ProfileField, string | number | null>>) =>
      (await api.patch(`/recruitment/candidates/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recruitment'] }),
  })
}

export function useUpdateApplication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; stage?: RecruitmentStage; isArchived?: boolean; notes?: string | null; scores?: Record<string, number | null> }) =>
      (await api.patch(`/recruitment/applications/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recruitment'] }),
  })
}

// ── Archivos ──────────────────────────────────────────────────────────────────

export async function openCandidateFile(file: CandidateFile, download = false) {
  // La pestaña se abre antes del await para que el navegador no la bloquee como popup
  const win = download ? null : window.open('', '_blank')
  try {
    const { data } = await api.get<Blob>(`/recruitment/files/${file.id}`, { params: download ? { download: 1 } : {}, responseType: 'blob' })
    const url = URL.createObjectURL(data)
    if (download) {
      const a = document.createElement('a')
      a.href = url; a.download = file.fileName; a.click()
    } else if (win) win.location.href = url
    else window.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    win?.close()
    throw err
  }
}

// ── Importación desde Drive ───────────────────────────────────────────────────

export interface CvData { fullName: string | null; email: string | null; phone: string | null; rut: string | null; linkedinUrl: string | null }

export interface ImportRow {
  drivePath:     string
  fileName:      string
  openingFolder: string
  folderPath:    string
  stage:         RecruitmentStage
  isArchived:    boolean
  source:        CandidateSource
  looksLikeCv:   boolean
  data:          CvData
  match?:        { candidateId: string; fullName: string; reason: string }
  movedFrom?:    string
}

export interface ImportPreview {
  root:      string
  rows:      ImportRow[]
  unchanged: number
  removed:   { id: string; drivePath: string; candidateName: string }[]
  openings:  { folder: string; exists: boolean; fileCount: number }[]
}

export interface ApplyRow {
  drivePath:   string
  stage:       RecruitmentStage
  fullName:    string
  email:       string | null
  phone:       string | null
  rut:         string | null
  linkedinUrl: string | null
  candidateId?: string | null
}

export function useDriveImportPreview(enabled: boolean) {
  return useQuery({
    queryKey: ['recruitment', 'drive-preview'],
    queryFn: async () => (await api.get<ImportPreview>('/recruitment/import/drive/preview', { params: { refresh: 1 }, timeout: 180_000 })).data,
    enabled,
    staleTime: Infinity,
    gcTime: 15 * 60 * 1000,
    retry: false,
  })
}

export function useApplyDriveImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { rows: ApplyRow[]; removedIds: string[] }) =>
      (await api.post<{ ok: true; stats: Record<string, number> }>('/recruitment/import/drive/apply', body, { timeout: 180_000 })).data,
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['recruitment', 'drive-preview'] })
      qc.invalidateQueries({ queryKey: ['recruitment'] })
    },
  })
}

export function useLastDriveImport() {
  return useQuery({
    queryKey: ['recruitment', 'last-import'],
    queryFn: async () => (await api.get<{ at: string; stats: Record<string, number> } | null>('/recruitment/import/drive/last')).data,
  })
}

// ── Preselección y puntajes ───────────────────────────────────────────────────

export type CriterionOperator = 'CONTAINS' | 'NOT_CONTAINS' | 'EQUALS' | 'GTE' | 'LTE' | 'NOT_EMPTY'

export const OPERATOR_LABEL: Record<CriterionOperator, string> = {
  CONTAINS: 'contiene', NOT_CONTAINS: 'no contiene', EQUALS: 'es igual a', GTE: 'es mayor o igual a', LTE: 'es menor o igual a', NOT_EMPTY: 'tiene dato',
}

export interface ScoringCriterion {
  id:            string
  jobOpeningId:  string
  name:          string
  type:          'MANUAL' | 'RULE'
  field:         ProfileField | null
  operator:      CriterionOperator | null
  value:         string | null
  pointsIfTrue:  number
  pointsIfFalse: number
  sortOrder:     number
}

export interface PreselectionRow {
  id:           string
  stage:        RecruitmentStage
  isArchived:   boolean
  notes:        string | null
  manualScores: Record<string, number>
  candidate:    CandidateProfile & {
    id: string; fullName: string; email: string | null; phone: string | null; linkedinUrl: string | null
    source: CandidateSource; files: CandidateFile[]
  }
}

export interface Preselection {
  opening:      Omit<JobOpening, 'byStage' | 'active' | 'archived'> & { criteria: ScoringCriterion[] }
  applications: PreselectionRow[]
}

/**
 * Puntaje de un criterio. RULE: cumple → pointsIfTrue, no cumple → pointsIfFalse.
 * En "contiene" / "es igual a" se aceptan varias alternativas separadas por coma ("Antofagasta, Calama").
 */
export function scoreCriterion(c: ScoringCriterion, row: PreselectionRow): number | null {
  if (c.type === 'MANUAL') return row.manualScores[c.id] ?? null
  if (!c.field || !c.operator) return null
  const raw = row.candidate[c.field]
  const empty = raw === null || raw === undefined || String(raw).trim() === ''
  if (c.operator === 'NOT_EMPTY') return empty ? c.pointsIfFalse : c.pointsIfTrue
  if (empty) return c.pointsIfFalse
  const text = fold(String(raw))
  const alts = (c.value ?? '').split(',').map(v => fold(v)).filter(Boolean)
  const num = (v: unknown) => Number(String(v).replace(',', '.'))
  let ok = false
  switch (c.operator) {
    case 'CONTAINS':     ok = alts.some(a => text.includes(a)); break
    case 'NOT_CONTAINS': ok = !alts.some(a => text.includes(a)); break
    case 'EQUALS':       ok = alts.some(a => text === a); break
    case 'GTE':          ok = num(raw) >= num(c.value); break
    case 'LTE':          ok = num(raw) <= num(c.value); break
  }
  return ok ? c.pointsIfTrue : c.pointsIfFalse
}

export function totalScore(criteria: ScoringCriterion[], row: PreselectionRow): number | null {
  const vals = criteria.map(c => scoreCriterion(c, row)).filter((v): v is number => v !== null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null
}

export function usePreselection(openingId: string | null) {
  return useQuery({
    queryKey: ['recruitment', 'preselection', openingId],
    queryFn: async () => (await api.get<Preselection>(`/recruitment/openings/${openingId}/preselection`)).data,
    enabled: !!openingId,
    placeholderData: prev => prev,
  })
}

export function useSaveCriterion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, openingId, ...body }: Partial<ScoringCriterion> & { openingId: string }) =>
      id ? (await api.patch(`/recruitment/criteria/${id}`, body)).data
         : (await api.post(`/recruitment/openings/${openingId}/criteria`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recruitment', 'preselection'] }),
  })
}

export function useDeleteCriterion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/recruitment/criteria/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recruitment', 'preselection'] }),
  })
}

// ── Perfil con IA (Gemini, a pedido) ──────────────────────────────────────────

export interface AiJob {
  running: boolean; done: number; total: number; ok: number; failed: number
  stoppedReason: string | null; startedAt: string; finishedAt: string | null
}

export type AiField = 'fullName' | 'email' | 'phone' | 'linkedinUrl' | ProfileField

export const AI_FIELD_LABEL: Record<AiField, string> = {
  fullName: 'Nombre', email: 'Correo', phone: 'Teléfono', linkedinUrl: 'LinkedIn',
  ...Object.fromEntries(PROFILE_FIELDS.map(f => [f.key, f.label])) as Record<ProfileField, string>,
}

export interface AiSuggestionRow extends CandidateProfile {
  id: string; fullName: string; email: string | null; phone: string | null; linkedinUrl: string | null
  aiSuggestion: Partial<Record<AiField, string | number | null>>
  aiSuggestedAt: string
}

export function useAiStatus() {
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['recruitment', 'ai-status'],
    queryFn: async () => {
      const data = (await api.get<{ configured: boolean; job: AiJob | null }>('/recruitment/ai/status')).data
      if (data.job && !data.job.running) qc.invalidateQueries({ queryKey: ['recruitment', 'ai-suggestions'] })
      return data
    },
    refetchInterval: q => (q.state.data?.job?.running ? 3000 : false),
  })
}

export function useStartAi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (candidateIds: string[]) => (await api.post<AiJob>('/recruitment/ai/start', { candidateIds })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recruitment', 'ai-status'] }),
  })
}

export function useAiSuggestions() {
  return useQuery({
    queryKey: ['recruitment', 'ai-suggestions'],
    queryFn: async () => (await api.get<AiSuggestionRow[]>('/recruitment/ai/suggestions')).data,
  })
}

export function useApplyAi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: { candidateId: string; fields: Record<string, string | number | null> }[]) =>
      (await api.post<{ applied: number; skipped: string[] }>('/recruitment/ai/apply', { items })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recruitment'] }),
  })
}

export function useDiscardAi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (candidateIds: string[]) => (await api.post('/recruitment/ai/discard', { candidateIds })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recruitment', 'ai-suggestions'] }),
  })
}

/** Perfil incompleto: le falta alguno de los datos principales */
export const profileIncomplete = (c: CandidateProfile) =>
  !c.professionalTitle || !c.city || c.yearsExperience === null || !c.lastPosition || !c.skills
