// Perfil del candidato leído por IA (Gemini, plan gratuito) — solo a pedido del usuario.
// Gemini recibe el PDF tal cual (sirve también para CVs escaneados); los Word van como texto.
// El resultado se guarda como sugerencia (Candidate.aiSuggestion) y se revisa antes de aplicarlo.
import { readFile } from 'fs/promises'
import { extname } from 'path'
import mammoth from 'mammoth'
import type { PrismaClient } from '@prisma/client'
import { absolutePath } from './recruitmentDriveImport.service'

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite'
const API   = 'https://generativelanguage.googleapis.com/v1beta/models'

export const AI_FIELDS = [
  'fullName', 'email', 'phone', 'linkedinUrl', 'professionalTitle', 'institution', 'city', 'yearsExperience',
  'lastEmployer', 'lastPosition', 'sector', 'skills', 'tools', 'certifications', 'availability',
] as const
export type AiField = (typeof AI_FIELDS)[number]
export type AiProfile = Partial<Record<AiField, string | number | null>>

const str = { type: 'STRING', nullable: true }
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    fullName: str, email: str, phone: str, linkedinUrl: str, professionalTitle: str, institution: str, city: str,
    yearsExperience: { type: 'NUMBER', nullable: true },
    lastEmployer: str, lastPosition: str, sector: str, skills: str, tools: str, certifications: str, availability: str,
  },
}

const PROMPT = `Eres asistente de reclutamiento en Chile. Del CV adjunto extrae los datos del postulante.
Reglas:
- Solo lo que diga el CV; si un dato no aparece, null. No inventes.
- fullName: nombre y apellidos del postulante, con mayúsculas y tildes correctas.
- phone: formato +56 9 XXXX XXXX si es chileno.
- linkedinUrl: URL completa del perfil (https://www.linkedin.com/in/...).
- professionalTitle: título o carrera principal (ej. "Periodista", "Técnico en Comunicación Audiovisual").
- institution: universidad o instituto de ese título.
- city: ciudad (o comuna) donde vive.
- yearsExperience: años de experiencia laboral total (número, puede ser decimal; estima por las fechas de los cargos).
- lastEmployer / lastPosition: empresa y cargo del trabajo más reciente.
- sector: rubro principal de su experiencia (ej. "Medios", "Publicidad", "Minería").
- skills: principales competencias, separadas por coma (máx. 8).
- tools: herramientas o software (ej. "Premiere, After Effects, Photoshop"), separadas por coma.
- certifications: cursos o certificaciones relevantes, separados por coma.
- availability: disponibilidad si la menciona (ej. "Inmediata").
Responde en español.`

export class AiQuotaError extends Error {}

async function callGemini(parts: unknown[], attempt = 0): Promise<AiProfile> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('Falta GEMINI_API_KEY en backend/.env')
  const res = await fetch(`${API}/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
    }),
  })
  if (res.status === 429) {
    const body: any = await res.json().catch(() => ({}))
    const msg = String(body?.error?.message ?? '')
    // Cuota diaria agotada: no tiene sentido reintentar hoy
    if (/per ?day|PerDay|daily/i.test(msg) || attempt >= 4) throw new AiQuotaError(msg || 'Cuota de Gemini agotada')
    const retry = body?.error?.details?.find((d: any) => d.retryDelay)?.retryDelay as string | undefined
    const wait = retry ? parseFloat(retry) * 1000 : 15_000 * (attempt + 1)
    await new Promise(r => setTimeout(r, Math.min(wait + 500, 90_000)))
    return callGemini(parts, attempt + 1)
  }
  if (res.status >= 500 && attempt < 2) {
    await new Promise(r => setTimeout(r, 5000))
    return callGemini(parts, attempt + 1)
  }
  const body: any = await res.json()
  if (!res.ok) throw new Error(body?.error?.message ?? `Gemini respondió ${res.status}`)
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini no devolvió datos (¿CV ilegible?)')
  return JSON.parse(text)
}

/** Lee un CV de Drive con Gemini */
export async function extractProfileWithAi(drivePath: string): Promise<AiProfile> {
  const buf = await readFile(absolutePath(drivePath))
  const ext = extname(drivePath).toLowerCase()
  const doc = ext === '.pdf'
    ? { inline_data: { mime_type: 'application/pdf', data: buf.toString('base64') } }
    : { text: `CV:\n${(await mammoth.extractRawText({ buffer: buf })).value.slice(0, 30_000)}` }
  const out = await callGemini([doc, { text: PROMPT }])
  // Limpieza: solo campos conocidos, textos recortados, vacíos → null
  const clean: AiProfile = {}
  for (const f of AI_FIELDS) {
    const v = out[f]
    if (v === null || v === undefined || v === '') continue
    clean[f] = f === 'yearsExperience' ? Number(v) : String(v).trim().slice(0, 1000)
  }
  if (typeof clean.yearsExperience === 'number' && (isNaN(clean.yearsExperience) || clean.yearsExperience < 0 || clean.yearsExperience > 60)) delete clean.yearsExperience
  if (typeof clean.email === 'string') clean.email = clean.email.toLowerCase()
  return clean
}

// ── Lote en segundo plano ─────────────────────────────────────────────────────

export interface AiJob {
  running: boolean; done: number; total: number; ok: number; failed: number
  stoppedReason: string | null; startedAt: string; finishedAt: string | null
}
let job: AiJob | null = null
export const aiJobStatus = () => job

// Plan gratuito: pocas solicitudes por minuto → una a la vez, con pausa entre CVs
const PAUSE_MS = Number(process.env.GEMINI_PAUSE_MS ?? 4500)

export function startAiJob(prisma: PrismaClient, candidateIds: string[]) {
  if (job?.running) throw new Error('Ya hay un lote de IA en curso')
  const current: AiJob = {
    running: true, done: 0, total: candidateIds.length, ok: 0, failed: 0,
    stoppedReason: null, startedAt: new Date().toISOString(), finishedAt: null,
  }
  job = current
  void (async () => {
    try {
      for (const id of candidateIds) {
        // CV más reciente del candidato que siga en Drive
        const file = await prisma.candidateFile.findFirst({
          where: { candidateId: id, removedAt: null }, orderBy: { modifiedAt: 'desc' }, select: { drivePath: true },
        })
        try {
          if (!file) throw new Error('Sin CV en Drive')
          const profile = await extractProfileWithAi(file.drivePath)
          await prisma.candidate.update({ where: { id }, data: { aiSuggestion: profile as any, aiSuggestedAt: new Date() } })
          current.ok++
        } catch (err) {
          if (err instanceof AiQuotaError) { current.stoppedReason = 'Se agotó la cuota gratuita de Gemini por hoy. Los que faltan se pueden procesar mañana.'; break }
          current.failed++
        }
        current.done++
        if (current.done < current.total) await new Promise(r => setTimeout(r, PAUSE_MS))
      }
    } finally {
      current.running = false
      current.finishedAt = new Date().toISOString()
    }
  })()
  return current
}
