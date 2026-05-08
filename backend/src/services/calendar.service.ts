import { google } from 'googleapis'

// ─── Config desde variables de entorno ───────────────────────────────────────
// GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL — email de la service account
// GOOGLE_CALENDAR_PRIVATE_KEY           — clave privada (con \n literales)
// GOOGLE_CALENDAR_IMPERSONATE           — cuenta que "posee" los calendarios (ej: rrhh@surmedia.cl)

function getAuth(impersonateAs?: string) {
  const email      = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL
  const privateKey = (process.env.GOOGLE_CALENDAR_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')
  const impersonate = impersonateAs ?? process.env.GOOGLE_CALENDAR_IMPERSONATE

  if (!email || !privateKey) {
    throw new Error('Faltan variables GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL o GOOGLE_CALENDAR_PRIVATE_KEY')
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
    subject: impersonate, // domain-wide delegation
  })

  return auth
}

export interface CalendarEventParams {
  title:           string
  description?:    string
  startDate:       Date        // fecha base del evento (ya calculada con daysFromStart)
  durationMinutes: number
  attendees:       string[]    // emails de los asistentes
  calendarId?:     string      // 'primary' por defecto
  location?:       string
  impersonateAs?:  string      // sobrescribe GOOGLE_CALENDAR_IMPERSONATE
}

export interface CalendarEventResult {
  eventId:   string
  eventLink: string
  htmlLink:  string
}

export async function createCalendarEvent(params: CalendarEventParams): Promise<CalendarEventResult> {
  const auth     = getAuth(params.impersonateAs)
  const calendar = google.calendar({ version: 'v3', auth })

  const startTime = new Date(params.startDate)
  const endTime   = new Date(startTime.getTime() + params.durationMinutes * 60_000)

  const event = {
    summary:     params.title,
    description: params.description,
    location:    params.location,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'America/Santiago',
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'America/Santiago',
    },
    attendees: params.attendees.map(email => ({ email })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email',  minutes: 24 * 60 },
        { method: 'popup',  minutes: 30 },
      ],
    },
    conferenceData: undefined as any, // sin Google Meet por defecto
  }

  const res = await calendar.events.insert({
    calendarId:              params.calendarId ?? 'primary',
    requestBody:             event,
    sendUpdates:             'all', // envía invitaciones a los asistentes
    conferenceDataVersion:   0,
  })

  const created = res.data
  return {
    eventId:   created.id ?? '',
    eventLink: created.hangoutLink ?? created.htmlLink ?? '',
    htmlLink:  created.htmlLink ?? '',
  }
}
