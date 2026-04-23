import type { BukCompanyConfig, BukEmployee, BukPaginatedResponse } from './buk.types'

const BUK_API_PATH = '/api/v1/chile'
const PER_PAGE = 100
const MAX_RETRIES = 3

export class BukClient {
  private readonly config: BukCompanyConfig

  constructor(config: BukCompanyConfig) {
    this.config = config
  }

  // Construye los dos configs de empresa desde variables de entorno
  static fromEnv(): [BukClient, BukClient] {
    const comunicaciones = new BukClient({
      legalEntity: 'COMUNICACIONES_SURMEDIA',
      name: 'Comunicaciones Surmedia Spa',
      baseUrl: process.env.BUK_URL_COMUNICACIONES ?? '',
      apiKey: process.env.BUK_API_KEY_COMUNICACIONES ?? '',
      asistenciaKey: process.env.BUK_ASISTENCIA_KEY_COMUNICACIONES ?? '',
      editorKey: process.env.BUK_EDITOR_KEY_COMUNICACIONES ?? '',
    })

    const consultoria = new BukClient({
      legalEntity: 'SURMEDIA_CONSULTORIA',
      name: 'Surmedia Consultoría Spa',
      baseUrl: process.env.BUK_URL_CONSULTORIA ?? '',
      apiKey: process.env.BUK_API_KEY_CONSULTORIA ?? '',
      asistenciaKey: process.env.BUK_ASISTENCIA_KEY_CONSULTORIA ?? '',
      editorKey: process.env.BUK_EDITOR_KEY_CONSULTORIA ?? '',
    })

    return [comunicaciones, consultoria]
  }

  get legalEntity() {
    return this.config.legalEntity
  }

  get companyName() {
    return this.config.name
  }

  private async fetchWithRetry(url: string, attempt = 1): Promise<Response> {
    try {
      const res = await fetch(url, {
        headers: {
          auth_token: this.config.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })

      if (res.status === 429 && attempt <= MAX_RETRIES) {
        // Rate limit: esperar antes del retry con backoff exponencial
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt))
        return this.fetchWithRetry(url, attempt + 1)
      }

      if (!res.ok) {
        throw new Error(`BUK API error ${res.status} en ${url}: ${await res.text()}`)
      }

      return res
    } catch (err) {
      if (attempt <= MAX_RETRIES && isTransientError(err)) {
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt))
        return this.fetchWithRetry(url, attempt + 1)
      }
      throw err
    }
  }

  // Descarga todos los colaboradores paginando automáticamente
  async fetchAllEmployees(): Promise<BukEmployee[]> {
    const employees: BukEmployee[] = []
    let page = 1
    let totalPages = 1

    do {
      const url = `${this.config.baseUrl}${BUK_API_PATH}/employees?page=${page}&page_size=${PER_PAGE}`
      const res = await this.fetchWithRetry(url)
      const body = await res.json() as BukPaginatedResponse<BukEmployee>

      const pageEmployees = body.data ?? []
      employees.push(...pageEmployees)

      totalPages = body.pagination?.total_pages ?? 1

      page++
    } while (page <= totalPages)

    return employees
  }

  // Obtiene el detalle de un colaborador específico
  async fetchEmployee(bukId: number): Promise<BukEmployee> {
    const url = `${this.config.baseUrl}${BUK_API_PATH}/employees/${bukId}`
    const res = await this.fetchWithRetry(url)
    const body = await res.json() as { data: BukEmployee }
    return body.data
  }
}

function isTransientError(err: unknown): boolean {
  if (err instanceof TypeError) return true  // network failure
  if (err instanceof Error) {
    return err.message.includes('ECONNRESET') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('fetch failed')
  }
  return false
}
