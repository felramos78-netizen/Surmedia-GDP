// Publica una versión nueva de GDP para que las apps instaladas se actualicen.
//   1. Sube la versión (1.0.N → 1.0.N+1) en desktop/package.json
//   2. Arma el paquete autónomo (scripts/stage.js) y corre la prueba de humo (scripts/smoke.js)
//      antes de empaquetar y otra vez sobre el paquete final
//   3. Genera el instalador y lo copia a la carpeta compartida de versiones con su latest.json
//   4. Anota la publicación en versiones/historial-publicaciones.log
// Si algo falla, no se publica nada y la versión vuelve a la anterior.
// Uso: npm run publicar             (desde desktop/)
//      npm run publicar -- "nota"   (agrega una nota a las novedades)
const { execSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { isNewer } = require('../updater')

const desktop = path.resolve(__dirname, '..')
const repo = path.resolve(desktop, '..')
const releasesDir = process.env.GDP_RELEASES_DIR || 'G:\\Unidades compartidas\\GDP\\env de GDP\\versiones'
const pkgPath = path.join(desktop, 'package.json')
const KEEP_INSTALLERS = 3

const git = cmd => execSync(`git ${cmd}`, { cwd: repo, encoding: 'utf8' }).trim()

function run(cmd) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { cwd: desktop, stdio: 'inherit' })
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

function bumpPatch(version) {
  const [major, minor, patch] = version.split('.').map(Number)
  return `${major}.${minor}.${patch + 1}`
}

// Novedades = asuntos de los commits desde la versión publicada anterior
function releaseNotes(previousCommit) {
  let range = '-15'
  if (previousCommit) {
    try { git(`merge-base --is-ancestor ${previousCommit} HEAD`); range = `${previousCommit}..HEAD` } catch { /* historial reescrito */ }
  }
  const out = git(`log ${range} --pretty=format:%s`)
  return out ? out.split('\n') : []
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function main() {
  if (!fs.existsSync(path.dirname(releasesDir))) {
    throw new Error(`No se encuentra ${path.dirname(releasesDir)}. ¿Está abierto Google Drive?`)
  }
  fs.mkdirSync(releasesDir, { recursive: true })

  const previous = readJson(path.join(releasesDir, 'latest.json'))
  const pkgText = fs.readFileSync(pkgPath, 'utf8')
  const pkg = JSON.parse(pkgText)
  const base = previous && isNewer(previous.version, pkg.version) ? previous.version : pkg.version
  const version = bumpPatch(base)

  const commit = git('rev-parse HEAD')
  const dirty = git('status --porcelain').length > 0
  const extraNote = process.argv.slice(2).join(' ').trim()
  const notes = [
    ...(extraNote ? [extraNote] : []),
    ...releaseNotes(previous?.commit),
    ...(dirty ? ['(incluye cambios locales sin commit)'] : []),
  ]

  console.log(`Publicando GDP ${version} (anterior: ${previous?.version ?? 'ninguna'}) desde ${commit.slice(0, 7)}${dirty ? ' + cambios sin commit' : ''}`)
  if (dirty) console.log('⚠ Hay cambios sin commit: se publican igual, pero conviene commitear para saber qué va en cada versión.')

  pkg.version = version
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  try {
    run('node scripts/stage.js')
    run('node scripts/smoke.js')
    run('npx electron-builder --win nsis --publish never')
    // Segunda prueba, sobre lo que realmente se instala (con el GDP Surmedia.exe empaquetado)
    run('node scripts/smoke.js release/win-unpacked/resources "release/win-unpacked/GDP Surmedia.exe"')

    const file = `GDP Surmedia Setup ${version}.exe`
    const built = path.join(desktop, 'release', file)
    if (!fs.existsSync(built)) throw new Error(`No se generó ${built}`)

    console.log(`\nCopiando el instalador a ${releasesDir}…`)
    fs.copyFileSync(built, path.join(releasesDir, file))
    const hash = sha256(built)
    if (sha256(path.join(releasesDir, file)) !== hash) throw new Error('La copia en Drive no coincide con el instalador generado')

    const publishedBy = `${os.userInfo().username}@${os.hostname()}`
    const latest = { version, file, sha256: hash, publishedAt: new Date().toISOString(), publishedBy, commit, dirty, notes }
    // latest.json se escribe al final y de una vez: las apps solo ven la versión cuando el instalador ya está copiado
    const tmp = path.join(releasesDir, 'latest.json.tmp')
    fs.writeFileSync(tmp, JSON.stringify(latest, null, 2))
    fs.renameSync(tmp, path.join(releasesDir, 'latest.json'))

    fs.appendFileSync(path.join(releasesDir, 'historial-publicaciones.log'), [
      `${latest.publishedAt}  ${publishedBy}  publicó ${version} (commit ${commit.slice(0, 7)}${dirty ? ', con cambios sin commit' : ''})`,
      ...notes.map(n => `    • ${n}`),
      '',
    ].join('\n'))

    // Se conservan los últimos instaladores (para volver atrás a mano si hiciera falta)
    const installers = fs.readdirSync(releasesDir)
      .filter(f => /^GDP Surmedia Setup [\d.]+\.exe$/.test(f))
      .sort((a, b) => (isNewer(a.match(/[\d.]+(?=\.exe)/)[0], b.match(/[\d.]+(?=\.exe)/)[0]) ? -1 : 1))
    for (const old of installers.slice(KEEP_INSTALLERS)) fs.rmSync(path.join(releasesDir, old), { force: true })

    console.log(`\n✔ GDP ${version} publicado. Las apps instaladas lo ofrecerán al abrir (o con GDP → Buscar actualizaciones).`)
    console.log('  Recuerda commitear desktop/package.json (nueva versión).')
  } catch (err) {
    fs.writeFileSync(pkgPath, pkgText) // vuelve a la versión anterior
    throw err
  }
}

try {
  main()
} catch (err) {
  console.error(`\n✘ No se publicó: ${err.message}`)
  process.exit(1)
}
