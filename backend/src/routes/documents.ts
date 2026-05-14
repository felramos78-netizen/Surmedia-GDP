import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import fs from 'fs'
import path from 'path'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'documents')

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

function buildProcessVars(proc: any): Record<string, string> {
  const start = proc.startDate
    ? new Date(proc.startDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''
  return {
    nombre:            proc.collaboratorName ?? '',
    primerNombre:      (proc.collaboratorName ?? '').split(' ')[0] ?? '',
    apellido:          (proc.collaboratorName ?? '').split(' ').slice(1).join(' ') ?? '',
    rut:               '',
    cargo:             proc.collaboratorPosition ?? '',
    empresa:           proc.legalEntity === 'COMUNICACIONES_SURMEDIA' ? 'Comunicaciones Surmedia Spa' : 'Surmedia Consultoría Spa',
    email:             proc.collaboratorEmail ?? '',
    emailPersonal:     proc.collaboratorPersonalEmail ?? '',
    telefono:          proc.collaboratorPhone ?? '',
    centroTrabajo:     proc.costCenter ?? '',
    fechaIngreso:      start,
    fechaIngresoCorta: proc.startDate ? new Date(proc.startDate).toLocaleDateString('es-CL') : '',
    fechaActual:       new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
    año:               new Date().getFullYear().toString(),
  }
}

const documentsRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = fastify.prisma

  // GET /documents — listar documentos
  fastify.get('/documents', async (_req, reply) => {
    const docs = await prisma.onboardingDocument.findMany({
      where: { isActive: true },
      include: { templateLinks: true },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data: docs })
  })

  // POST /documents — subir documento .docx
  fastify.post('/documents', async (req, reply) => {
    if (!req.isMultipart()) {
      return reply.status(400).send({ message: 'Se requiere multipart/form-data' })
    }

    const parts = req.parts()
    let docName = ''
    let description = ''
    let fileName = ''
    let fileBuffer: Buffer | null = null
    const chunks: Buffer[] = []

    for await (const part of parts) {
      if (part.type === 'file') {
        fileName = part.filename
        for await (const chunk of part.file) {
          chunks.push(chunk as Buffer)
        }
        fileBuffer = Buffer.concat(chunks)
      } else {
        if (part.fieldname === 'name') docName = part.value as string
        if (part.fieldname === 'description') description = part.value as string
      }
    }

    if (!fileBuffer || !fileName) {
      return reply.status(400).send({ message: 'No se recibió ningún archivo' })
    }

    if (!fileName.endsWith('.docx')) {
      return reply.status(400).send({ message: 'Solo se aceptan archivos .docx' })
    }

    const id = crypto.randomUUID()
    const storedName = `${id}-${fileName}`
    const filePath = path.join(UPLOADS_DIR, storedName)
    fs.writeFileSync(filePath, fileBuffer)

    const doc = await prisma.onboardingDocument.create({
      data: {
        id,
        name: docName || fileName.replace('.docx', ''),
        fileName,
        filePath: storedName,
        description: description || null,
      },
      include: { templateLinks: true },
    })

    return reply.status(201).send({ data: doc })
  })

  // PATCH /documents/:id — actualizar nombre/descripción
  fastify.patch<{
    Params: { id: string }
    Body: { name?: string; description?: string }
  }>('/documents/:id', async (req, reply) => {
    const data: Record<string, any> = {}
    if (req.body.name !== undefined) data.name = req.body.name
    if (req.body.description !== undefined) data.description = req.body.description
    try {
      const doc = await prisma.onboardingDocument.update({
        where: { id: req.params.id },
        data,
        include: { templateLinks: true },
      })
      return reply.send({ data: doc })
    } catch {
      return reply.status(404).send({ message: 'Documento no encontrado' })
    }
  })

  // DELETE /documents/:id — eliminar documento
  fastify.delete<{ Params: { id: string } }>('/documents/:id', async (req, reply) => {
    const doc = await prisma.onboardingDocument.findUnique({ where: { id: req.params.id } })
    if (!doc) return reply.status(404).send({ message: 'Documento no encontrado' })

    const fullPath = path.join(UPLOADS_DIR, doc.filePath)
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)

    await prisma.onboardingDocument.delete({ where: { id: req.params.id } })
    return reply.status(204).send()
  })

  // POST /documents/:id/link — vincular a plantilla de correo
  fastify.post<{
    Params: { id: string }
    Body: { templateKey: string; sendAs?: string }
  }>('/documents/:id/link', async (req, reply) => {
    const { templateKey, sendAs = 'WORD' } = req.body
    if (!templateKey) return reply.status(400).send({ message: 'templateKey requerido' })
    try {
      const link = await prisma.onboardingDocumentTemplate.create({
        data: { documentId: req.params.id, templateKey, sendAs },
      })
      return reply.status(201).send({ data: link })
    } catch (err: any) {
      if (err.code === 'P2002') return reply.status(409).send({ message: 'Ya vinculado a esta plantilla' })
      throw err
    }
  })

  // PATCH /documents/:id/link/:templateKey — cambiar sendAs
  fastify.patch<{
    Params: { id: string; templateKey: string }
    Body: { sendAs: string }
  }>('/documents/:id/link/:templateKey', async (req, reply) => {
    await prisma.onboardingDocumentTemplate.updateMany({
      where: { documentId: req.params.id, templateKey: req.params.templateKey },
      data: { sendAs: req.body.sendAs },
    })
    return reply.send({ data: { ok: true } })
  })

  // DELETE /documents/:id/link/:templateKey — desvincular
  fastify.delete<{
    Params: { id: string; templateKey: string }
  }>('/documents/:id/link/:templateKey', async (req, reply) => {
    await prisma.onboardingDocumentTemplate.deleteMany({
      where: { documentId: req.params.id, templateKey: req.params.templateKey },
    })
    return reply.status(204).send()
  })

  // GET /documents/:id/download — descargar original
  fastify.get<{ Params: { id: string } }>('/documents/:id/download', async (req, reply) => {
    const doc = await prisma.onboardingDocument.findUnique({ where: { id: req.params.id } })
    if (!doc) return reply.status(404).send({ message: 'Documento no encontrado' })

    const fullPath = path.join(UPLOADS_DIR, doc.filePath)
    if (!fs.existsSync(fullPath)) return reply.status(404).send({ message: 'Archivo no encontrado en disco' })

    const stream = fs.createReadStream(fullPath)
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`)
    return reply.send(stream)
  })

  // POST /documents/:id/render — aplicar variables y descargar
  fastify.post<{
    Params: { id: string }
    Body: { processId?: string; vars?: Record<string, string>; format?: string }
  }>('/documents/:id/render', async (req, reply) => {
    const doc = await prisma.onboardingDocument.findUnique({ where: { id: req.params.id } })
    if (!doc) return reply.status(404).send({ message: 'Documento no encontrado' })

    const fullPath = path.join(UPLOADS_DIR, doc.filePath)
    if (!fs.existsSync(fullPath)) return reply.status(404).send({ message: 'Archivo no encontrado en disco' })

    const { processId, vars: extraVars = {}, format = 'WORD' } = req.body

    let templateVars: Record<string, string> = {}

    if (processId) {
      const proc = await prisma.onboardingProcess.findUnique({ where: { id: processId } })
      if (proc) Object.assign(templateVars, buildProcessVars(proc))
    }

    // Extra vars override process vars
    Object.assign(templateVars, extraVars)

    // Apply variables using docxtemplater with {{}} delimiters
    let rendered: Buffer
    try {
      const PizZip = require('pizzip')
      const Docxtemplater = require('docxtemplater')

      const fileBuffer = fs.readFileSync(fullPath)
      const zip = new PizZip(fileBuffer)
      const docxTemplate = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        errorLogging: false,
      })
      docxTemplate.setData(templateVars)
      docxTemplate.render()
      rendered = docxTemplate.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' })
    } catch (err: any) {
      return reply.status(422).send({ message: `Error al procesar el documento: ${err.message ?? err}` })
    }

    if (format === 'PDF') {
      try {
        const libre = require('libreoffice-convert')
        const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
          libre.convert(rendered, '.pdf', undefined, (err: any, done: Buffer) => {
            if (err) reject(err)
            else resolve(done)
          })
        })
        reply.header('Content-Type', 'application/pdf')
        reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName.replace('.docx', '.pdf'))}"`)
        return reply.send(pdfBuffer)
      } catch {
        // LibreOffice no disponible — devolver Word con header de aviso
        reply.header('X-Pdf-Fallback', 'true')
      }
    }

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`)
    return reply.send(rendered)
  })
}

export default fp(documentsRoutes)
