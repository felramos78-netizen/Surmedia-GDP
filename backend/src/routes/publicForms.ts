import type { FastifyPluginAsync } from 'fastify'

// Rutas públicas para formularios de onboarding (sin autenticación)
// Prefix: /api/forms

const publicFormsRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = fastify.prisma as any

  // GET /api/forms/:token — schema del formulario (sin auth)
  fastify.get<{ Params: { token: string } }>('/:token', async (req, reply) => {
    const form = await prisma.onboardingForm.findUnique({
      where: { token: req.params.token },
      include: {
        process: {
          select: { collaboratorName: true, collaboratorPosition: true, legalEntity: true },
        },
      },
    })
    if (!form || !form.isActive) return reply.status(404).send({ message: 'Formulario no encontrado o inactivo' })
    return reply.send({ data: form })
  })

  // POST /api/forms/:token/submit — envío público de respuesta (sin auth)
  fastify.post<{
    Params: { token: string }
    Body: { respondentName?: string; respondentEmail?: string; data: Record<string, unknown> }
  }>('/:token/submit', async (req, reply) => {
    const form = await prisma.onboardingForm.findUnique({
      where: { token: req.params.token },
    })
    if (!form || !form.isActive) return reply.status(404).send({ message: 'Formulario no encontrado o inactivo' })

    const response = await prisma.formResponse.create({
      data: {
        formId:          form.id,
        respondentName:  req.body.respondentName?.trim() || null,
        respondentEmail: req.body.respondentEmail?.trim() || null,
        data:            req.body.data ?? {},
      },
    })
    return reply.status(201).send({ data: response, message: 'Respuesta registrada correctamente' })
  })
}

export default publicFormsRoutes
