// electron-builder excluye siempre las carpetas node_modules de extraResources,
// así que las dependencias del backend se copian aquí, después de empaquetar y
// antes de generar el instalador.
const fs = require('fs')
const path = require('path')

exports.default = async function afterPack(context) {
  const from = path.resolve(__dirname, '..', 'stage', 'backend', 'node_modules')
  const to = path.join(context.appOutDir, 'resources', 'backend', 'node_modules')
  if (!fs.existsSync(from)) throw new Error(`Falta ${from}: corre primero scripts/stage.js`)
  fs.cpSync(from, to, { recursive: true })
  const engine = path.join(to, '.prisma', 'client', 'query_engine-windows.dll.node')
  if (!fs.existsSync(engine)) throw new Error('El motor de Prisma no quedó dentro del paquete')
  console.log(`  • dependencias del backend copiadas a ${path.relative(process.cwd(), to)}`)
}
