// Prueba de humo del paquete (control de calidad antes de publicar): levanta el
// backend de desktop/stage con el mismo Node de Electron que usará la app,
// y comprueba que responda, que sirva la interfaz y que Prisma llegue a la base.
// Uso: node scripts/smoke.js                 → revisa desktop/stage con el Electron de desarrollo
//      node scripts/smoke.js <resources> <exe> → revisa la app ya empaquetada (release/win-unpacked)
// `npm run publicar` corre ambas: antes de empaquetar y sobre el resultado final.
const { spawn } = require('child_process')
const fs = require('fs')
const net = require('net')
const os = require('os')
const path = require('path')
const util = require('util')

const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', 'stage')
const electron = process.argv[3] ? path.resolve(process.argv[3]) : require('electron') // ejecutable con el que corre el backend
const backendDir = path.join(root, 'backend')
const frontendDir = path.join(root, 'frontend')
const envFile = process.env.GDP_ENV_FILE || 'G:\\Unidades compartidas\\GDP\\env de GDP\\.env'

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)) })
  })
}

function check(label, ok, detail = '') {
  console.log(`${ok ? '✔' : '✘'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) throw new Error(`Prueba de humo fallida: ${label}`)
}

// Consulta a la base con el cliente Prisma empaquetado, en el runtime de Electron
function prismaCheck(env) {
  const code = `
    const { PrismaClient } = require(${JSON.stringify(path.join(backendDir, 'node_modules', '@prisma', 'client'))})
    const p = new PrismaClient()
    p.user.count().then(n => { console.log(n); return p.$disconnect() }).catch(e => { console.error(e.message); process.exit(1) })`
  return new Promise(resolve => {
    const child = spawn(electron, ['-e', code], { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true })
    let out = ''
    child.stdout.on('data', d => { out += d })
    child.stderr.on('data', d => { out += d })
    child.on('exit', status => resolve({ ok: status === 0, out: out.trim() }))
  })
}

async function main() {
  console.log(`Revisando ${root}`)
  check('existe el .env compartido', fs.existsSync(envFile), envFile)
  check('existe el backend empaquetado', fs.existsSync(path.join(backendDir, 'dist', 'server.js')))
  check('existe la interfaz empaquetada', fs.existsSync(path.join(frontendDir, 'index.html')))

  const port = await freePort()
  const env = {
    ...process.env,
    ...util.parseEnv(fs.readFileSync(envFile, 'utf8')),
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    PORT: String(port),
    HOST: '127.0.0.1',
    GDP_STATIC_DIR: frontendDir,
  }

  const db = await prismaCheck(env)
  check('Prisma se conecta a la base de datos', db.ok, db.ok ? `${db.out} usuarios` : db.out)

  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gdp-smoke-'))
  const server = spawn(electron, [path.join(backendDir, 'dist', 'server.js')], { cwd, env, windowsHide: true })
  let output = ''
  server.stdout.on('data', d => { output += d })
  server.stderr.on('data', d => { output += d })
  let exitCode = null
  server.on('exit', code => { exitCode = code })

  try {
    const base = `http://127.0.0.1:${port}`
    // Hasta 2 minutos: con poca memoria libre el primer arranque puede ser lento
    const started = Date.now()
    let healthy = false
    for (let i = 0; i < 240 && exitCode === null && !healthy; i++) {
      await new Promise(r => setTimeout(r, 500))
      healthy = await fetch(`${base}/api/health`).then(r => r.ok).catch(() => false)
    }
    const detail = healthy
      ? `${Math.round((Date.now() - started) / 1000)} s`
      : exitCode !== null ? `el proceso terminó con código ${exitCode}` : 'sin respuesta en 2 minutos'
    if (!healthy) console.log(output.split('\n').slice(-20).join('\n') || '(el servidor no escribió nada)')
    check('el servidor arranca y responde /api/health', healthy, detail)

    const html = await fetch(`${base}/colaboradores`).then(r => r.text())
    check('sirve la interfaz (ruta de React)', html.includes('<div id="root"'))

    const api404 = await fetch(`${base}/api/no-existe`).then(r => r.status)
    check('las rutas /api desconocidas responden 404', api404 === 404)
  } finally {
    server.kill()
    await new Promise(r => setTimeout(r, 500))
    fs.rmSync(cwd, { recursive: true, force: true })
  }
  console.log('\nPrueba de humo OK')
}

main().catch(err => { console.error(`\n${err.message}`); process.exit(1) })
