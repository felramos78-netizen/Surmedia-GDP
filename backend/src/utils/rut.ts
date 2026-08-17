/**
 * Normalización de RUT chileno al estándar GDP: `XX.XXX.XXX-X`,
 * con puntos de miles y dígito verificador en mayúscula.
 *
 * El identificador único de todo colaborador es el RUT, así que TODA escritura
 * y toda búsqueda deben pasar por acá. Guardar un RUT sin normalizar hace que
 * las búsquedas normalizadas no lo encuentren (ese fue el origen del error
 * "Colaborador no encontrado en la base de datos" en onboarding).
 *
 *   "15848359-9"    → "15.848.359-9"
 *   "15.848.359-k"  → "15.848.359-K"
 *   ""              → ""
 *   "sin guion"     → "sin guion"  (se devuelve tal cual si no tiene DV)
 */
export function normalizeRut(raw: string | null | undefined): string {
  if (!raw) return ''
  const clean = raw.replace(/\./g, '').trim()
  const [body, dv] = clean.split('-')
  if (!body || !dv) return raw.trim()
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv.toUpperCase()}`
}
