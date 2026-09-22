import type { FastifyPluginAsync } from 'fastify'
import { Readable } from 'stream'
import type { LegalEntity } from '@prisma/client'
import { requireRole } from '../middleware/requireRole'
import { BUK_ENTITIES, findBukEmployees, listEmployeeFiles, fetchEmployeeFile, type BukFile } from '../services/bukApi.service'

// Documentos de colaboradores leídos en vivo desde BUK (ambas razones sociales).
// Solo lectura: no se guarda ningún archivo en GDP. Acceso restringido a ADMIN
// porque incluye liquidaciones y contratos.

interface EntityDocs {
  legalEntity:   LegalEntity
  bukEmployeeId: number | null
  bukStatus?:    string
  files:         BukFile[]
  error?:        string
}

const bukDocumentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)
  fastify.addHook('preHandler', requireRole('ADMIN'))

  // GET /api/documents/employee/:employeeId — documentos del colaborador en cada razón social
  fastify.get<{ Params: { employeeId: string } }>('/employee/:employeeId', async (req, reply) => {
    const emp = await fastify.prisma.employee.findUnique({
      where:  { id: req.params.employeeId },
      select: { id: true, rut: true },
    })
    if (!emp) return reply.status(404).send({ message: 'Colaborador no encontrado' })

    const entities = await Promise.all(BUK_ENTITIES.map(async (legalEntity): Promise<EntityDocs[]> => {
      try {
        const refs = await findBukEmployees(legalEntity, emp.rut)
        if (!refs.length) return [{ legalEntity, bukEmployeeId: null, files: [] }]
        return await Promise.all(refs.map(async ref => ({
          legalEntity,
          bukEmployeeId: ref.id,
          bukStatus:     ref.status,
          files: await listEmployeeFiles(legalEntity, ref.id),
        })))
      } catch (err) {
        fastify.log.error(err, `Error leyendo documentos BUK (${legalEntity})`)
        return [{ legalEntity, bukEmployeeId: null, files: [], error: 'No se pudo consultar BUK' }]
      }
    }))

    return { rut: emp.rut, entities: entities.flat() }
  })

  // GET /api/documents/file/:legalEntity/:bukEmployeeId/:fileId?download=1 — proxy del archivo
  fastify.get<{
    Params: { legalEntity: string; bukEmployeeId: string; fileId: string }
    Querystring: { download?: string; filename?: string }
  }>('/file/:legalEntity/:bukEmployeeId/:fileId', async (req, reply) => {
    const legalEntity   = req.params.legalEntity as LegalEntity
    const bukEmployeeId = Number(req.params.bukEmployeeId)
    const fileId        = Number(req.params.fileId)
    if (!BUK_ENTITIES.includes(legalEntity) || !Number.isInteger(bukEmployeeId) || !Number.isInteger(fileId)) {
      return reply.status(400).send({ message: 'Parámetros inválidos' })
    }

    let file: Response
    try {
      file = await fetchEmployeeFile(legalEntity, bukEmployeeId, fileId)
    } catch (err) {
      fastify.log.error(err, 'Error descargando documento BUK')
      return reply.status(502).send({ message: 'No se pudo obtener el archivo desde BUK' })
    }

    const filename    = (req.query.filename || `documento-${fileId}`).replace(/["\r\n]/g, '')
    const disposition = req.query.download ? 'attachment' : 'inline'
    reply
      .header('Content-Type', file.headers.get('content-type') ?? 'application/octet-stream')
      .header('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`)
      .header('Cache-Control', 'private, no-store')
    const length = file.headers.get('content-length')
    if (length) reply.header('Content-Length', length)
    return reply.send(Readable.fromWeb(file.body as any))
  })
}

export default bukDocumentsRoutes
