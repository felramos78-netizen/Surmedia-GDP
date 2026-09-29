// Actualizaciones de GDP desde la carpeta compartida de Drive.
// `npm run publicar` (scripts/publish.js) deja ahí el instalador y un latest.json;
// la app lo lee al abrir, ofrece actualizar, copia el instalador a una carpeta
// temporal, verifica su hash y lo ejecuta en modo silencioso, que reabre GDP.
// Cada paso queda en el registro local y en versiones/registro/<usuario>.log.
const { app, dialog } = require('electron')
const { spawn } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

const DEFAULT_RELEASES_DIR = 'G:\\Unidades compartidas\\GDP\\env de GDP\\versiones'

let ctx = null // { log, config, onBeforeInstall, parentWindow }

function init(options) { ctx = options }

// Diálogo sobre la ventana principal si existe (showMessageBox no acepta null)
function box(options) {
  const win = ctx.parentWindow()
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
}

const releasesDir = () => ctx.config().releasesDir || DEFAULT_RELEASES_DIR
const pendingFile = () => path.join(app.getPath('userData'), 'update-pending.json')
const localUpdatesLog = () => path.join(app.getPath('userData'), 'logs', 'actualizaciones.log')
const who = () => `${os.userInfo().username}@${os.hostname()}`

// "1.0.10" > "1.0.9"
function isNewer(a, b) {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0)
  }
  return false
}

// Registro de actualizaciones: local (siempre) y compartido (si Drive está disponible).
// Cada equipo escribe su propio archivo compartido para evitar conflictos de Drive.
function record(event) {
  const line = `${new Date().toISOString()}  ${who()}  ${event}\n`
  ctx.log(`[update] ${event}`)
  try {
    fs.mkdirSync(path.dirname(localUpdatesLog()), { recursive: true })
    fs.appendFileSync(localUpdatesLog(), line)
  } catch { /* sin registro local */ }
  try {
    const dir = path.join(releasesDir(), 'registro')
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, `${os.userInfo().username}.log`), line)
  } catch { /* Drive no disponible */ }
}

// Al abrir: confirma si la actualización pendiente se instaló
function confirmPendingUpdate() {
  let pending
  try { pending = JSON.parse(fs.readFileSync(pendingFile(), 'utf8')) } catch { return }
  fs.rmSync(pendingFile(), { force: true })
  const current = app.getVersion()
  if (current === pending.to) record(`OK: actualizado de ${pending.from} a ${pending.to}`)
  else record(`ERROR: se intentó actualizar de ${pending.from} a ${pending.to}, pero sigue la ${current}`)
}

function readLatest() {
  const file = path.join(releasesDir(), 'latest.json')
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

async function sha256(file) {
  const hash = crypto.createHash('sha256')
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

function formatNotes(latest) {
  const notes = (latest.notes || []).slice(0, 12).map(n => `• ${n}`)
  if ((latest.notes || []).length > 12) notes.push(`• … y ${latest.notes.length - 12} cambios más`)
  return notes.length ? `Novedades:\n${notes.join('\n')}` : ''
}

// manual = true cuando se pide desde el menú (avisa también si no hay nada nuevo).
// Devuelve true si se lanzó la instalación (GDP se está cerrando).
async function checkForUpdates({ manual = false } = {}) {
  if (!app.isPackaged) {
    if (manual) dialog.showMessageBox({ type: 'info', title: 'GDP Surmedia', message: 'En modo desarrollo no se instalan actualizaciones.' })
    return
  }
  let latest
  try {
    latest = readLatest()
  } catch (err) {
    ctx.log(`[update] no se pudo leer latest.json: ${err.message}`)
    if (manual) dialog.showMessageBox({ type: 'error', title: 'GDP Surmedia', message: 'No se pudo leer la información de versiones.', detail: err.message })
    return
  }
  if (!latest) {
    ctx.log(`[update] sin latest.json en ${releasesDir()}`)
    if (manual) {
      dialog.showMessageBox({
        type: 'warning', title: 'GDP Surmedia',
        message: 'No se encontró la carpeta de versiones.',
        detail: `Revisa que Google Drive esté abierto y sincronizado:\n${releasesDir()}`,
      })
    }
    return
  }

  const current = app.getVersion()
  if (!isNewer(latest.version, current)) {
    if (manual) dialog.showMessageBox({ type: 'info', title: 'GDP Surmedia', message: `Tienes la última versión (${current}).` })
    return
  }

  const { response } = await box({
    type: 'info', title: 'Actualización disponible',
    message: `Hay una versión nueva de GDP: ${latest.version} (tienes la ${current}).`,
    detail: [
      `Publicada el ${new Date(latest.publishedAt).toLocaleString('es-CL')} por ${latest.publishedBy}.`,
      formatNotes(latest),
      'GDP se cerrará unos segundos y se abrirá solo con la versión nueva.',
    ].filter(Boolean).join('\n\n'),
    buttons: ['Actualizar ahora', 'Más tarde'], defaultId: 0, cancelId: 1,
  })
  if (response !== 0) {
    record(`pospuesta la ${latest.version} (tiene la ${current})`)
    return
  }
  return install(latest, current)
}

async function install(latest, current) {
  try {
    record(`descargando la ${latest.version} (tiene la ${current})`)
    ctx.onProgress('Descargando la actualización…')
    // Se copia fuera de Drive: el instalador no debe ejecutarse desde una carpeta que se sincroniza
    const source = path.join(releasesDir(), latest.file)
    const tmpDir = path.join(os.tmpdir(), 'gdp-update')
    fs.rmSync(tmpDir, { recursive: true, force: true })
    fs.mkdirSync(tmpDir, { recursive: true })
    const target = path.join(tmpDir, latest.file)
    await fs.promises.copyFile(source, target)

    ctx.onProgress('Verificando la actualización…')
    const hash = await sha256(target)
    if (hash !== latest.sha256) throw new Error('El instalador descargado no coincide con el publicado (¿Drive aún sincronizando?). Intenta de nuevo en unos minutos.')

    fs.writeFileSync(pendingFile(), JSON.stringify({ from: current, to: latest.version, at: new Date().toISOString() }))
    record(`instalando la ${latest.version}`)
    await ctx.onBeforeInstall()
    // /S = instalación silenciosa; --force-run = abrir GDP al terminar
    spawn(target, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref()
    app.quit()
    return true
  } catch (err) {
    record(`ERROR al actualizar a la ${latest.version}: ${err.message}`)
    ctx.onProgress(null)
    box({
      type: 'error', title: 'GDP Surmedia',
      message: 'No se pudo actualizar GDP.', detail: err.message,
    })
  }
}

module.exports = { init, checkForUpdates, confirmPendingUpdate, releasesDir, DEFAULT_RELEASES_DIR, isNewer }
