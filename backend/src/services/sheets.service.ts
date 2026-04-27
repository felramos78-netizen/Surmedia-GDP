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

export async function getSheetRows(spreadsheetId: string, sheetName: string): Promise<Record<string, string>[]> {
  const auth   = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  })

  const rows = res.data.values ?? []
  if (rows.length < 2) return []

  const headers = rows[0].map((h: string) => h.trim())
  return rows.slice(1).map(row =>
    Object.fromEntries(headers.map((h: string, i: number) => [h, String(row[i] ?? '')]))
  )
}

export async function getFormResponses(): Promise<Record<string, string>[]> {
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID ?? ''
  const sheetName     = process.env.SHEETS_FORM_SHEET     ?? 'Formulario de Ingreso'
  return getSheetRows(spreadsheetId, sheetName)
}
