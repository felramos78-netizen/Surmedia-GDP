// Carga inicial del estado de firma de todos los documentos BUK (una consulta por documento, ~10 min).
// Después, cada sincronización solo revisa los nuevos y los pendientes.
//   npx tsx --env-file=.env prisma/backfill-signatures.ts
import { PrismaClient } from '@prisma/client'
import { refreshSignatures, type SyncProgress } from '../src/services/bukDocumentSync.service'

const prisma = new PrismaClient()
const progress: SyncProgress = { scope: 'backfill', done: 0, total: 0 }
const timer = setInterval(() => console.log(`${progress.done}/${progress.total}`), 30_000)

refreshSignatures(prisma, {}, progress)
  .then(r => console.log('✔', r))
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => { clearInterval(timer); return prisma.$disconnect() })
