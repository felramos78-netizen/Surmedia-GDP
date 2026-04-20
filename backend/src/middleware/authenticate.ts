import fp from 'fastify-plugin'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>
  }
}

export default fp(async (fastify) => {
  fastify.decorate('authenticate', async (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
    try {
      await req.jwtVerify()
    } catch {
      reply.status(401).send({ message: 'No autorizado' })
    }
  })
})
