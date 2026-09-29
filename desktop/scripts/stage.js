// Arma en desktop/stage/ todo lo que el instalador lleva dentro, para que la app
// no dependa del repo, de git ni de Node en el equipo donde se instala:
//   stage/backend   → dist compilado + node_modules de producción + cliente Prisma
//   stage/frontend  → build de Vite
// Uso: node scripts/stage.js   (lo llama `npm run dist` y `npm run publicar`)
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const repo = path.resolve(__dirname, '..', '..')
const stage = path.resolve(__dirname, '..', 'stage')

function run(cmd, cwd) {
  console.log(`\n$ ${cmd}   (${path.relative(repo, cwd) || '.'})`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

function copyDir(from, to, filter = () => true) {
  fs.cpSync(from, to, { recursive: true, filter: src => fs.statSync(src).isDirectory() || filter(src) })
}

// Versión exacta instalada hoy en el monorepo, para no cambiar de versión al empaquetar
function installedVersion(dep, fallback) {
  const pkg = path.join(repo, 'node_modules', dep, 'package.json')
  return fs.existsSync(pkg) ? JSON.parse(fs.readFileSync(pkg, 'utf8')).version : fallback
}

function main() {
  // 1. Compilar. `vite build` y `tsc` directos: el `tsc -b` del frontend tiene
  //    errores de tipos antiguos que no afectan al empaquetado.
  run('npx vite build', path.join(repo, 'frontend'))
  run('npx tsc', path.join(repo, 'backend'))

  fs.rmSync(stage, { recursive: true, force: true })
  fs.mkdirSync(path.join(stage, 'backend', 'prisma'), { recursive: true })

  // 2. Backend: código compilado (sin mapas ni .d.ts) + schema para el cliente Prisma
  copyDir(path.join(repo, 'backend', 'dist'), path.join(stage, 'backend', 'dist'),
    src => !src.endsWith('.map') && !src.endsWith('.d.ts'))
  fs.copyFileSync(path.join(repo, 'backend', 'prisma', 'schema.prisma'), path.join(stage, 'backend', 'prisma', 'schema.prisma'))

  const backendPkg = JSON.parse(fs.readFileSync(path.join(repo, 'backend', 'package.json'), 'utf8'))
  const dependencies = Object.fromEntries(Object.entries(backendPkg.dependencies).map(([dep, range]) => [dep, installedVersion(dep, range)]))
  fs.writeFileSync(path.join(stage, 'backend', 'package.json'), JSON.stringify({
    name: 'gdp-backend', private: true, main: 'dist/server.js', dependencies,
  }, null, 2))

  // 3. Dependencias de producción aisladas (fuera del workspace) y cliente Prisma
  run('npm install --omit=dev --no-audit --no-fund --no-package-lock', path.join(stage, 'backend'))
  const prismaVersion = installedVersion('prisma', dependencies['@prisma/client'])
  // El CLI de Prisma se instala temporalmente junto al cliente (desde la caché de
  // npx no encuentra @prisma/client) y `npm prune` lo quita después de generar
  run(`npm install --no-save --no-audit --no-fund --no-package-lock prisma@${prismaVersion}`, path.join(stage, 'backend'))
  run('npx prisma generate --schema prisma/schema.prisma', path.join(stage, 'backend'))
  run('npm prune --omit=dev --no-audit --no-fund --no-package-lock', path.join(stage, 'backend'))

  // 4. Frontend compilado
  copyDir(path.join(repo, 'frontend', 'dist'), path.join(stage, 'frontend'))

  const engine = path.join(stage, 'backend', 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node')
  if (!fs.existsSync(engine)) throw new Error(`Falta el motor de Prisma en ${engine}`)
  console.log(`\nPaquete listo en ${stage}`)
}

main()
