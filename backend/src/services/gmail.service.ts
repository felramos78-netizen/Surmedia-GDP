import { google } from 'googleapis'
import nodemailer from 'nodemailer'
import type { EmailAttachment } from './email.service'

async function buildRawMime(params: {
  from:        string
  to:          string
  cc?:         string
  subject:     string
  html:        string
  attachments?: EmailAttachment[]
}): Promise<string> {
  const transport = nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true })
  const info = await transport.sendMail({
    from:    params.from,
    to:      params.to,
    cc:      params.cc,
    subject: params.subject,
    html:    params.html,
    attachments: params.attachments?.map(a => ({
      filename:    a.filename,
      content:     a.content,
      contentType: a.contentType,
    })),
  })
  return (info.message as Buffer).toString('base64url')
}

function makeOAuth2Client(refreshToken: string) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

export async function docxToPdfViaGoogleDrive(docxBuffer: Buffer, refreshToken: string): Promise<Buffer> {
  const auth  = makeOAuth2Client(refreshToken)
  const drive = google.drive({ version: 'v3', auth })

  // Subir el DOCX convirtiéndolo a Google Doc
  const { Readable } = await import('stream')
  const uploadRes = await drive.files.create({
    requestBody: { name: 'gdp-tmp-conversion', mimeType: 'application/vnd.google-apps.document' },
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      body:     Readable.from(docxBuffer),
    },
    fields: 'id',
  })
  const fileId = uploadRes.data.id!

  try {
    // Exportar como PDF
    const exportRes = await drive.files.export(
      { fileId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' }
    )
    return Buffer.from(exportRes.data as ArrayBuffer)
  } finally {
    // Eliminar el archivo temporal
    await drive.files.delete({ fileId }).catch(() => {})
  }
}

export async function fetchGmailSignature(refreshToken: string, senderEmail: string): Promise<string> {
  try {
    const gmail = google.gmail({ version: 'v1', auth: makeOAuth2Client(refreshToken) })
    const res   = await gmail.users.settings.sendAs.get({ userId: 'me', sendAsEmail: senderEmail })
    return res.data.signature ?? ''
  } catch {
    return ''
  }
}

export async function createGmailDraft(params: {
  refreshToken: string
  from:         string
  to:           string
  cc?:          string
  subject:      string
  html:         string
  attachments?: EmailAttachment[]
}): Promise<{ draftId: string; messageId: string }> {
  const raw   = await buildRawMime(params)
  const gmail = google.gmail({ version: 'v1', auth: makeOAuth2Client(params.refreshToken) })
  const res   = await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw } } })
  return { draftId: res.data.id ?? '', messageId: res.data.message?.id ?? '' }
}

export async function sendEmailViaGmail(params: {
  refreshToken: string
  from:         string
  to:           string
  cc?:          string
  subject:      string
  html:         string
  attachments?: EmailAttachment[]
}): Promise<{ messageId: string }> {

  const raw   = await buildRawMime(params)
  const gmail = google.gmail({ version: 'v1', auth: makeOAuth2Client(params.refreshToken) })
  const res   = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
  return { messageId: res.data.id ?? '' }
}
