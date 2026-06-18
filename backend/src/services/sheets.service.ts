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
    } else if (SHEET_BOOLEAN_FIELDS.has(field)) {
      // "tiene el dato cargado o no": cualquier valor cuenta como true salvo negaciones explícitas
      result[field] = !/^(no|false|0|n\/a|na|-)$/i.test(val)
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

export async function getSheetHeaders(spreadsheetId: string, sheetName?: string): Promise<string[]> {
  const auth   = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  let range = sheetName ?? ''
  if (!range) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    range = meta.data.sheets?.[0]?.properties?.title ?? 'Sheet1'
  }

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${range}!1:1` })
  const headerRow = res.data.values?.[0] ?? []
  return headerRow.map((h: string) => String(h).trim()).filter(Boolean)
}

export async function getSheetHeadersByUrl(url: string, sheetName?: string): Promise<string[]> {
  const id = extractSpreadsheetId(url)
  return getSheetHeaders(id, sheetName)
}

// Campos del sistema a los que se puede mapear una columna del sheet.
// Los que empiezan con "_" son virtuales: se combinan en lastName/address al aplicar.
export const SHEET_TARGET_FIELDS: { key: string; label: string; aliases: string[] }[] = [
  // Identidad
  { key: 'firstName',         label: 'Nombre(s)',                 aliases: ['nombres', 'nombre', 'primer nombre'] },
  { key: '_apellidoPaterno',  label: 'Apellido paterno',           aliases: ['apellido paterno', 'primer apellido'] },
  { key: '_apellidoMaterno',  label: 'Apellido materno',           aliases: ['apellido materno'] },
  { key: 'lastName',          label: 'Apellidos (completo)',       aliases: ['apellidos', 'apellido completo'] },
  { key: 'segundoApellido',   label: 'Segundo apellido',           aliases: ['segundo apellido'] },
  { key: 'gender',            label: 'Sexo / Género',              aliases: ['sexo', 'genero', 'género'] },
  { key: 'birthDate',         label: 'Fecha de nacimiento',        aliases: ['fecha de nacimiento', 'fecha nacimiento'] },
  { key: 'nationality',       label: 'Nacionalidad',               aliases: ['nacionalidad'] },
  { key: 'estadoCivil',       label: 'Estado civil',               aliases: ['estado civil'] },
  { key: 'nivelEducacional',  label: 'Nivel educacional',          aliases: ['nivel educacional', 'nivel de estudios'] },
  { key: 'profesion',         label: 'Profesión',                  aliases: ['profesion', 'profesión'] },
  { key: 'contactoEmergencia',label: 'Contacto de emergencia',     aliases: ['contacto de emergencia', 'contacto emergencia'] },
  // Contacto
  { key: 'personalEmail',     label: 'Email personal',             aliases: ['email personal', 'correo personal'] },
  { key: 'email',             label: 'Email corporativo',          aliases: ['correo del empleado empresa', 'correo empresa', 'email corporativo', 'correo corporativo'] },
  { key: 'phone',             label: 'Teléfono / Celular',         aliases: ['celular', 'telefono', 'teléfono', 'fono'] },
  // Dirección
  { key: '_direccionCalle',   label: 'Dirección — calle',          aliases: ['direccion calle', 'dirección calle', 'calle'] },
  { key: '_direccionNumero',  label: 'Dirección — número',         aliases: ['direccion numero', 'dirección número', 'numero', 'número'] },
  { key: '_direccionDepto',   label: 'Dirección — depto',          aliases: ['direccion departamento', 'dirección departamento', 'departamento', 'depto'] },
  { key: 'address',           label: 'Dirección (completa)',       aliases: ['direccion', 'dirección', 'direccion completa'] },
  { key: 'commune',           label: 'Comuna',                     aliases: ['direccion comuna', 'dirección comuna', 'comuna'] },
  { key: 'city',              label: 'Ciudad',                     aliases: ['direccion ciudad', 'dirección ciudad', 'ciudad'] },
  // Previsión y salud
  { key: 'afp',               label: 'AFP',                        aliases: ['informacion previsional (afp)', 'información previsional (afp)', 'informacion previsional afp', 'afp'] },
  { key: 'isapre',            label: 'Isapre / Fonasa',            aliases: ['sistema de salud (isapre o fonasa)', 'sistema de salud', 'isapre', 'fonasa'] },
  { key: 'montoIsapre',       label: 'Monto pactado Isapre (UF)',  aliases: ['monto pactado isapre'] },
  { key: 'esPensionado',      label: '¿Es pensionado?',            aliases: ['es pensionado', 'pensionado'] },
  { key: 'previredCode',      label: 'Código Previred',            aliases: ['codigo previred', 'previred'] },
  // APV
  { key: 'apv',               label: 'APV',                        aliases: ['apv'] },
  { key: 'apvMonto',          label: 'APV — monto',                aliases: ['apv monto'] },
  { key: 'apvMoneda',         label: 'APV — moneda',               aliases: ['apv moneda'] },
  { key: 'apvInstitucion',    label: 'APV — institución',          aliases: ['apv institucion', 'apv institución'] },
  { key: 'apvTipo',           label: 'APV — tipo',                 aliases: ['apv tipo'] },
  { key: 'tieneFun',          label: 'FUN adjunto (sí/no)',        aliases: ['adjuntar fun', 'fun'] },
  // Datos bancarios
  { key: 'banco',             label: 'Banco',                      aliases: ['banco'] },
  { key: 'tipoCuenta',        label: 'Tipo de cuenta',             aliases: ['tipo de cuenta'] },
  { key: 'numeroCuenta',      label: 'Número de cuenta',           aliases: ['numero de cuenta', 'número de cuenta'] },
  // EPP / tallas
  { key: 'usoLentes',         label: 'Uso de lentes ópticas',      aliases: ['uso de lentes', 'lentes opticas', 'lentes ópticas'] },
  { key: 'tallaPolera',       label: 'Talla polera',               aliases: ['talla polera'] },
  { key: 'tallaPantalon',     label: 'Talla pantalón',             aliases: ['talla pantalon', 'talla pantalón'] },
  { key: 'tallaCalzado',      label: 'Talla calzado',              aliases: ['talla calzado', 'talla zapato'] },
  // Datos laborales
  { key: 'jobTitle',          label: 'Cargo',                      aliases: ['cargo'] },
  { key: 'jobFamily',         label: 'Familia de cargo',           aliases: ['familia de cargo', 'familia'] },
  { key: 'workSchedule',      label: 'Jornada laboral',            aliases: ['jornada laboral', 'jornada'] },
  { key: 'distribucionJornada', label: 'Distribución jornada (días)', aliases: ['distribucion jornada', 'distribución jornada', 'distribucion de jornada'] },
  { key: 'costCenter',        label: 'Centro de costos',           aliases: ['centro de costos', 'centro de costo'] },
  { key: 'supervisorName',    label: 'Jefe / Supervisor',          aliases: ['jefe', 'supervisor', 'jefatura'] },
  { key: 'supervisorTitle',   label: 'Cargo del supervisor',       aliases: ['cargo supervisor', 'cargo del jefe'] },
  { key: 'vinculo',           label: 'Vínculo',                    aliases: ['vinculo', 'vínculo'] },
  { key: 'reemplazaA',        label: 'Reemplaza a',                aliases: ['reemplaza a', 'reemplaza'] },
  { key: 'exclusive',         label: 'Exclusividad (sí/no)',       aliases: ['exclusividad', 'exclusivo'] },
  // Documentos de acreditación (solo indican si está cargado o no)
  { key: 'docCedula',         label: 'Documento: Cédula de identidad',     aliases: ['cedula de identidad', 'cédula de identidad', 'cedula'] },
  { key: 'docCertAfp',        label: 'Documento: Certificado AFP',         aliases: ['certificado de afiliacion afp', 'certificado afiliacion afp', 'certificado afp'] },
  { key: 'docCertIsapre',     label: 'Documento: Certificado Isapre',      aliases: ['certificado de afiliacion isapre', 'certificado afiliacion isapre', 'certificado isapre'] },
  { key: 'docCertTitulo',     label: 'Documento: Certificado de título',   aliases: ['certificado de titulo academico', 'certificado de titulo', 'certificado titulo'] },
  { key: 'docLicenciaConducir', label: 'Documento: Licencia de conducir',  aliases: ['licencia de conducir'] },
  { key: 'docCartaRenuncia',  label: 'Documento: Carta de renuncia',       aliases: ['carta de renuncia'] },
]

// Campos que se guardan como booleano (true = el dato/documento está cargado).
export const SHEET_BOOLEAN_FIELDS = new Set<string>([
  'tieneFun', 'exclusive',
  'docCedula', 'docCertAfp', 'docCertIsapre', 'docCertTitulo', 'docLicenciaConducir', 'docCartaRenuncia',
])

function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Sugiere un mapeo columna→campo del sistema comparando encabezados normalizados contra alias conocidos.
export function suggestColumnMappings(headers: string[], rutColumn?: string): Record<string, string> {
  const suggested: Record<string, string> = {}
  const usedFields = new Set<string>()

  for (const header of headers) {
    if (rutColumn && normalizeHeader(header) === normalizeHeader(rutColumn)) continue

    const normHeader = normalizeHeader(header)
    let best: { key: string; score: number } | null = null

    for (const field of SHEET_TARGET_FIELDS) {
      if (usedFields.has(field.key)) continue
      for (const alias of field.aliases) {
        const normAlias = normalizeHeader(alias)
        if (normHeader === normAlias) {
          best = { key: field.key, score: 100 }
          break
        }
        if (normHeader.includes(normAlias) || normAlias.includes(normHeader)) {
          const score = normAlias.length
          if (!best || score > best.score) best = { key: field.key, score }
        }
      }
      if (best?.score === 100) break
    }

    if (best) {
      suggested[header] = best.key
      usedFields.add(best.key)
    }
  }

  return suggested
}

export async function getFormResponses(): Promise<Record<string, string>[]> {
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID ?? ''
  const sheetName     = process.env.SHEETS_FORM_SHEET     ?? 'Formulario de Ingreso'
  return getSheetRows(spreadsheetId, sheetName)
}
