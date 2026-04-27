import { FastifyInstance } from 'fastify'

export default async function profileRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma

  // GET /profiles
  fastify.get('/', async () => {
    return prisma.profile.findMany({
      include: { roles: true },
      orderBy: { name: 'asc' },
    })
  })

  // POST /profiles
  fastify.post<{
    Body: {
      name: string
      position: string
      email: string
      phone?: string
      notes?: string
      roles?: { area: string; roleType: string }[]
    }
  }>('/', async (req, reply) => {
    const { name, position, email, phone, notes, roles = [] } = req.body
    if (!name?.trim())     return reply.status(400).send({ message: 'El nombre es requerido' })
    if (!position?.trim()) return reply.status(400).send({ message: 'El cargo es requerido' })
    if (!email?.trim())    return reply.status(400).send({ message: 'El correo es requerido' })

    const profile = await prisma.profile.create({
      data: {
        name: name.trim(),
        position: position.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        notes: notes?.trim() || null,
        roles: { create: roles.map(r => ({ area: r.area, roleType: r.roleType })) },
      },
      include: { roles: true },
    })
    return reply.status(201).send(profile)
  })

  // PATCH /profiles/:id
  fastify.patch<{
    Params: { id: string }
    Body: {
      name?: string
      position?: string
      email?: string
      phone?: string | null
      notes?: string | null
      roles?: { area: string; roleType: string }[]
    }
  }>('/:id', async (req, reply) => {
    const { id } = req.params
    const { roles, ...fields } = req.body
    const updateData: Record<string, any> = {}

    if (fields.name !== undefined)     updateData.name     = fields.name.trim()
    if (fields.position !== undefined) updateData.position = fields.position.trim()
    if (fields.email !== undefined)    updateData.email    = fields.email.trim().toLowerCase()
    if (fields.phone !== undefined)    updateData.phone    = fields.phone?.trim() || null
    if (fields.notes !== undefined)    updateData.notes    = fields.notes?.trim() || null

    if (roles !== undefined) {
      await prisma.profileRole.deleteMany({ where: { profileId: id } })
      updateData.roles = { create: roles.map(r => ({ area: r.area, roleType: r.roleType })) }
    }

    const profile = await prisma.profile.update({
      where: { id },
      data: updateData,
      include: { roles: true },
    })
    return profile
  })

  // DELETE /profiles/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    await prisma.profile.delete({ where: { id: req.params.id } })
    return reply.status(204).send()
  })
}
