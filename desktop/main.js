// GDP Surmedia — aplicación de escritorio (Electron).
// Levanta el backend como proceso hijo (con el Node que trae Electron); el backend
// sirve también el frontend compilado y la ventana carga esa URL local. Al cerrar
// la ventana se apaga el backend.
//
// Instalada (app.isPackaged): todo viene dentro del instalador (resources/backend,
// resources/frontend; ver scripts/stage.js) y el .env se lee desde la carpeta
// compartida de Drive. Las actualizaciones llegan por Drive (updater.js).
// Desarrollo (`npm start`): usa backend/dist, frontend/dist y backend/.env del repo.
const { app, BrowserWindow, Menu, dialog, shell } = require('electron')
const { execFileSync, spawn } = require('child_process')
const fs = require('fs')
const net = require('net')
const path = require('path')
const util = require('util')
const updater = require('./updater')

const DEFAULT_ENV_FILE = 'G:\\Unidades compartidas\\GDP\\env de GDP\\.env'
const REPO_DIR = path.resolve(__dirname, '..')

// Desarrollo con datos, bloqueo de instancia y puerto propios, para poder abrirlo
// junto a la app instalada. 4780 está registrado en Google Cloud; 4781 no, así que
// en desarrollo se entra con usuario y contraseña.
if (!app.isPackaged) app.setName('GDP Surmedia (dev)')
const PREFERRED_PORT = app.isPackaged ? 4780 : 4781

let backend = null
let backendPort = null
let mainWindow = null
let splash = null
let quitting = false
let launching = false
let logStream = null

// ── Rutas y configuración ─────────────────────────────────────────────────────

const configPath = () => path.join(app.getPath('userData'), 'config.json')
const logDir = () => path.join(app.getPath('userData'), 'logs')
const logFile = () => path.join(logDir(), 'gdp.log')

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

const config = () => readJson(configPath()) ?? {}

function saveConfig(patch) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(configPath(), JSON.stringify({ ...config(), ...patch }, null, 2))
}

const backendDir = () => app.isPackaged ? path.join(process.resourcesPath, 'backend') : path.join(REPO_DIR, 'backend')
const frontendDist = () => app.isPackaged ? path.join(process.resourcesPath, 'frontend') : path.join(REPO_DIR, 'frontend', 'dist')
const serverJs = () => path.join(backendDir(), 'dist', 'server.js')
const envFile = () => app.isPackaged ? (config().envFile || DEFAULT_ENV_FILE) : path.join(REPO_DIR, 'backend', '.env')

// Carpeta de trabajo del backend (uploads/ de documentos de onboarding, etc.).
// Instalada va en los datos del usuario: la carpeta del programa se reemplaza al actualizar.
function backendCwd() {
  if (!app.isPackaged) return backendDir()
  const dir = path.join(app.getPath('userData'), 'data')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// ── Logs ──────────────────────────────────────────────────────────────────────

function log(line) {
  if (!logStream) {
    fs.mkdirSync(logDir(), { recursive: true })
    // Se conserva el registro de la sesión anterior (útil si GDP se cerró por un error)
    try { fs.renameSync(logFile(), path.join(logDir(), 'gdp.anterior.log')) } catch { /* primera vez */ }
    logStream = fs.createWriteStream(logFile(), { flags: 'w' })
    logStream.write(`${new Date().toISOString()} [gdp] GDP Surmedia ${app.getVersion()}${app.isPackaged ? '' : ' (desarrollo)'}\n`)
  }
  logStream.write(`${new Date().toISOString()} ${line}\n`)
}

// ── Pantalla de carga ─────────────────────────────────────────────────────────

function showSplash() {
  if (splash && !splash.isDestroyed()) return
  splash = new BrowserWindow({
    width: 420, height: 260, frame: false, resizable: false, center: true, alwaysOnTop: true,
    backgroundColor: '#016D8C', icon: path.join(__dirname, 'build', 'icon.png'),
  })
  splash.loadFile(path.join(__dirname, 'splash.html'), { query: { v: app.getVersion() } })
}

function setStatus(text) {
  log(`[gdp] ${text}`)
  if (!splash || splash.isDestroyed()) return
  const js = `window.setStatus && window.setStatus(${JSON.stringify(text)})`
  if (splash.webContents.isLoading()) splash.webContents.once('did-finish-load', () => splash?.webContents.executeJavaScript(js).catch(() => {}))
  else splash.webContents.executeJavaScript(js).catch(() => {})
}

function closeSplash() {
  if (splash && !splash.isDestroyed()) splash.close()
  splash = null
}

// ── Compilación (solo desarrollo) ─────────────────────────────────────────────

function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    log(`$ ${cmd}  (en ${cwd})`)
    const child = spawn(cmd, { cwd, shell: true, windowsHide: true })
    child.stdout.on('data', d => log(d.toString().trimEnd()))
    child.stderr.on('data', d => log(d.toString().trimEnd()))
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`"${cmd}" terminó con código ${code}`)))
  })
}

const isBuilt = () => fs.existsSync(serverJs()) && fs.existsSync(path.join(frontendDist(), 'index.html'))

async function buildFromRepo() {
  // `vite build` y `tsc` directos: el `tsc -b` del frontend tiene errores de tipos antiguos
  setStatus('Compilando la interfaz…')
  await run('npx vite build', path.join(REPO_DIR, 'frontend'))
  setStatus('Compilando el servidor…')
  await run('npx tsc', backendDir())
}

// ── Backend ───────────────────────────────────────────────────────────────────

function portIsFree(port) {
  return new Promise(resolve => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, '127.0.0.1')
  })
}

function randomFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)) })
  })
}

class EnvMissingError extends Error {}

function loadEnvFile() {
  const file = envFile()
  if (!fs.existsSync(file)) throw new EnvMissingError(`No se encontró el archivo de configuración:\n${file}`)
  return util.parseEnv(fs.readFileSync(file, 'utf8'))
}

// Si la app se cerró de golpe (Administrador de tareas, apagado), el backend pudo
// quedar vivo ocupando el puerto. Se guarda su PID para detenerlo al volver a abrir.
const pidFile = () => path.join(app.getPath('userData'), 'backend.pid')

function killOrphanBackend() {
  const pid = Number(readJson(pidFile())?.pid)
  if (!pid) return
  try {
    // Confirma que el PID sigue siendo un proceso de GDP (y no otro que reutilizó el número)
    const row = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true })
    if (row.toLowerCase().includes(`"${path.basename(process.execPath).toLowerCase()}"`)) {
      process.kill(pid)
      log(`[gdp] se detuvo un servidor anterior que seguía corriendo (PID ${pid})`)
    }
  } catch { /* ya no existe */ }
  fs.rmSync(pidFile(), { force: true })
}

// Login con Google: se hace en el navegador del sistema; Google vuelve al backend
// de la app (GOOGLE_REDIRECT_URI) y el backend entrega el token por IPC.
function onBackendMessage(msg) {
  if (!mainWindow || !msg || typeof msg !== 'object') return
  const base = `http://127.0.0.1:${backendPort}`
  if (msg.type === 'google-auth') {
    const qs = new URLSearchParams({ token: msg.token, user: msg.user })
    mainWindow.loadURL(`${base}/auth/callback?${qs}`)
  } else if (msg.type === 'google-auth-error') {
    mainWindow.loadURL(`${base}/login?error=${encodeURIComponent(msg.code)}`)
  } else return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

async function startBackend() {
  setStatus('Iniciando el servidor…')
  const fileEnv = loadEnvFile()
  killOrphanBackend()
  await new Promise(r => setTimeout(r, 300)) // da tiempo a liberar el puerto
  // Mismo puerto siempre que se pueda: la sesión (localStorage) queda asociada a él
  backendPort = (await portIsFree(PREFERRED_PORT)) ? PREFERRED_PORT : await randomFreePort()
  const url = `http://127.0.0.1:${backendPort}`

  const env = {
    ...process.env,
    ...fileEnv,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    PORT: String(backendPort),
    HOST: '127.0.0.1',
    APP_URL: url,
    GDP_STATIC_DIR: frontendDist(),
    GDP_DESKTOP: '1',
    // Debe estar registrada en Google Cloud Console (cliente OAuth de GDP)
    GOOGLE_REDIRECT_URI: `http://localhost:${backendPort}/api/auth/google/callback`,
  }
  if (backendPort !== 4780) log(`[gdp] aviso: puerto ${backendPort}; el login con Google solo funciona en el 4780`)
  backend = spawn(process.execPath, [serverJs()], { cwd: backendCwd(), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  backend.stdout.on('data', d => log(d.toString().trimEnd()))
  backend.stderr.on('data', d => log(d.toString().trimEnd()))
  backend.on('message', onBackendMessage)
  fs.writeFileSync(pidFile(), JSON.stringify({ pid: backend.pid }))

  const proc = backend
  const exited = new Promise(resolve => proc.once('exit', code => resolve(code)))
  proc.once('exit', code => {
    log(`[gdp] backend terminó (código ${code})`)
    if (readJson(pidFile())?.pid === proc.pid) fs.rmSync(pidFile(), { force: true })
    if (backend === proc) backend = null
    if (!quitting && mainWindow && proc.expectedExit !== true) onBackendCrash()
  })

  // Espera a que responda /api/health (o a que el proceso muera)
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    const code = await Promise.race([exited, new Promise(r => setTimeout(() => r(undefined), 500))])
    if (code !== undefined) throw new Error(`El servidor se cerró al iniciar (código ${code}).`)
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok) return url
    } catch { /* todavía no escucha */ }
  }
  throw new Error('El servidor no respondió en 90 segundos.')
}

function stopBackend() {
  if (!backend) return Promise.resolve()
  const proc = backend
  backend = null
  proc.expectedExit = true
  return new Promise(resolve => {
    proc.once('exit', () => resolve())
    proc.kill()
    setTimeout(resolve, 5000)
  })
}

async function onBackendCrash() {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'error', title: 'GDP Surmedia',
    message: 'El servidor de GDP se detuvo.',
    detail: `Revisa el registro en ${logFile()}`,
    buttons: ['Reiniciar', 'Ver registro', 'Salir'], defaultId: 0,
  })
  if (response === 0) return restart(false)
  if (response === 1) shell.openPath(logFile())
  app.quit()
}

// ── Ventana principal ─────────────────────────────────────────────────────────

function isLocal(url) {
  return url.startsWith(`http://127.0.0.1:${backendPort}`) || url.startsWith('blob:') || url === 'about:blank' || url === ''
}

function attachLinkHandling(win) {
  // Links externos (Gmail, Google Calendar, LinkedIn…) → navegador del sistema.
  // Ventanas locales (archivos abiertos como blob) → ventana de GDP.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isLocal(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 1000, height: 800, icon: path.join(__dirname, 'build', 'icon.png') },
      }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    // Google no permite iniciar sesión dentro de apps embebidas: el login va al navegador
    const isGoogleLogin = url.startsWith(`http://127.0.0.1:${backendPort}/api/auth/google`)
    if (!isLocal(url) || isGoogleLogin) { e.preventDefault(); shell.openExternal(url) }
  })
  // Redirecciones del servidor hacia afuera (no pasan por will-navigate)
  win.webContents.on('will-redirect', (e, url) => {
    if (!isLocal(url)) { e.preventDefault(); shell.openExternal(url) }
  })
}

app.on('browser-window-created', (_e, win) => attachLinkHandling(win))

function createMainWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 640, show: false,
    title: windowTitle(), icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true },
  })
  mainWindow.webContents.session.setSpellCheckerLanguages(['es'])
  // El título muestra la versión (el frontend no lo cambia)
  mainWindow.on('page-title-updated', e => e.preventDefault())
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize(); mainWindow.show(); closeSplash()
    setTimeout(() => updater.checkForUpdates(), 3000)
  })
  mainWindow.on('closed', () => { mainWindow = null; app.quit() })
  mainWindow.loadURL(url)
}

const windowTitle = () => `GDP Surmedia ${app.getVersion()}${app.isPackaged ? '' : ' (desarrollo)'}`

// ── Menú ──────────────────────────────────────────────────────────────────────

function buildMenu() {
  const updatesLog = path.join(logDir(), 'actualizaciones.log')
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'GDP',
      submenu: [
        { label: 'Recargar', accelerator: 'F5', click: () => mainWindow?.webContents.reload() },
        { label: 'Buscar actualizaciones', click: () => updater.checkForUpdates({ manual: true }) },
        { type: 'separator' },
        ...(app.isPackaged ? [] : [{ label: 'Recompilar desde el código local', click: () => restart('build') }]),
        { label: 'Reiniciar servidor', click: () => restart(false) },
        { type: 'separator' },
        { label: 'Ver registro', click: () => shell.openPath(logFile()) },
        { label: 'Ver historial de actualizaciones', click: () => fs.existsSync(updatesLog) ? shell.openPath(updatesLog) : dialog.showMessageBox({ type: 'info', title: 'GDP Surmedia', message: 'Todavía no hay actualizaciones registradas en este equipo.' }) },
        { label: 'Abrir carpeta de registros', click: () => shell.openPath(logDir()) },
        { type: 'separator' },
        {
          label: 'Acerca de GDP',
          click: () => dialog.showMessageBox({
            type: 'info', title: 'GDP Surmedia',
            message: windowTitle(),
            detail: [
              `Configuración: ${envFile()}`,
              `Versiones: ${updater.releasesDir()}`,
              `Registros: ${logDir()}`,
            ].join('\n'),
          }),
        },
        { label: 'Salir', role: 'quit' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, { type: 'separator' },
        { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' }, { role: 'resetZoom', label: 'Tamaño real' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
      ],
    },
  ]))
}

// ── Arranque ──────────────────────────────────────────────────────────────────

// Sin .env (Drive cerrado o sin sincronizar): reintentar o elegir el archivo a mano
async function askForEnvFile(err) {
  const { response } = await dialog.showMessageBox({
    type: 'warning', title: 'GDP Surmedia',
    message: 'GDP no encuentra su configuración.',
    detail: `${err.message}\n\nRevisa que Google Drive para escritorio esté abierto y sincronizado.`,
    buttons: ['Reintentar', 'Elegir archivo…', 'Salir'], defaultId: 0, cancelId: 2,
  })
  if (response === 0) return true
  if (response === 1) {
    const res = await dialog.showOpenDialog({ title: 'Archivo .env de GDP', properties: ['openFile', 'showHiddenFiles'] })
    if (res.filePaths[0]) { saveConfig({ envFile: res.filePaths[0] }); return true }
    return askForEnvFile(err)
  }
  return false
}

async function launch(mode) {
  launching = true
  showSplash()
  try {
    if (!app.isPackaged && (mode === 'build' || !isBuilt())) await buildFromRepo()
    const url = await startBackend()
    if (mainWindow) { mainWindow.loadURL(url); closeSplash() }
    else createMainWindow(url)
  } catch (err) {
    log(`[gdp] error: ${err.stack || err.message}`)
    closeSplash()
    if (err instanceof EnvMissingError) {
      if (await askForEnvFile(err)) return launch(mode)
      return app.quit()
    }
    // Si esta versión no logra arrancar, la corrección puede estar ya publicada
    if (await updater.checkForUpdates()) return
    const { response } = await dialog.showMessageBox({
      type: 'error', title: 'GDP Surmedia',
      message: 'No se pudo iniciar GDP.',
      detail: `${err.message}\n\nRegistro: ${logFile()}`,
      buttons: ['Reintentar', 'Ver registro', 'Salir'], defaultId: 0,
    })
    if (response === 0) return launch(mode)
    if (response === 1) shell.openPath(logFile())
    app.quit()
  } finally {
    launching = false
  }
}

async function restart(mode) {
  await stopBackend()
  await launch(mode)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    updater.init({
      log,
      config,
      parentWindow: () => mainWindow,
      onProgress: text => { if (text) { showSplash(); setStatus(text) } else closeSplash() },
      onBeforeInstall: () => stopBackend(),
    })
    updater.confirmPendingUpdate()
    buildMenu()
    await launch(false)
  })

  app.on('before-quit', () => { quitting = true })
  app.on('will-quit', e => {
    if (!backend) return
    e.preventDefault()
    stopBackend().then(() => app.quit())
  })
  // Durante el arranque se cierra la pantalla de carga antes de abrir la ventana principal
  app.on('window-all-closed', () => { if (!launching) app.quit() })
}
