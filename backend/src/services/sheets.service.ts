import { google } from 'googleapis'

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export function extractSpreadsheetId(url: string): string {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!m) throw new Error(`URL de Google Sheets inválida: ${url}`)
  return m[1]
}

export function normalizeRut(rut: string): string {
  return rut.replace(/[\s.\-]/g, '').toUpperCase()
}

export async function getSheetRows(spreadsheetId: string, sheetName?: string): Promise<Record<string, string>[]> {
  const auth   = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  // If no sheetName, get the first tab
  let range = sheetName ?? ''
  if (!range) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    range = meta.data.sheets?.[0]?.properties?.title ?? 'Sheet1'
  }

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })

  const rows = res.data.values ?? []
  if (rows.length < 2) return []

  const headers = rows[0].map((h: string) => h.trim())
  return rows.slice(1).map(row =>
    Object.fromEntries(headers.map((h: string, i: number) => [h, String(row[i] ?? '').trim()]))
  )
}

export async function getSheetRowsByUrl(url: string, sheetName?: string): Promise<Record<string, string>[]> {
  const id = extractSpreadsheetId(url)
  return getSheetRows(id, sheetName)
}

export function findRowByRut(rows: Record<string, string>[], rutColumn: string, rut: string): Record<string, string> | null {
  const target = normalizeRut(rut)
  return rows.find(row => normalizeRut(row[rutColumn] ?? '') === target) ?? null
}

// Map a sheet row to employee fields using the template's columnMappings
export function mapRowToEmployee(row: Record<string, string>, columnMappings: Record<string, string>): Record<string, any> {
  const result: Record<string, any> = {}
  const virtuals: Record<string, string> = {}

  for (const [col, field] of Object.entries(columnMappings)) {
    const val = row[col]?.trim()
    if (!val) continue
    if (field.startsWith('_')) {
      virtuals[field] = val
    } else {
      result[field] = val
    }
  }

  // Compose lastName from paterno + materno
  const pat = virtuals['_apellidoPaterno']
  const mat = virtuals['_apellidoMaterno']
  if (pat || mat) result['lastName'] = [pat, mat].filter(Boolean).join(' ')

  // Compose address from street + number + depto
  const calle  = virtuals['_direccionCalle']
  const numero = virtuals['_direccionNumero']
  const depto  = virtuals['_direccionDepto']
  if (calle) result['address'] = [calle, numero, depto].filter(Boolean).join(' ')

  return result
}

export async function getFormResponses(): Promise<Record<string, string>[]> {
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID ?? ''
  const sheetName     = process.env.SHEETS_FORM_SHEET     ?? 'Formulario de Ingreso'
  return getSheetRows(spreadsheetId, sheetName)
}
