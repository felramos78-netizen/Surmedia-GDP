// Genera build/icon.png (512×512) a partir del mismo diseño del favicon de GDP.
// Uso: npm run icon
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="10" fill="#016D8C"/>
  <text x="24" y="33" font-family="Roboto, Arial, sans-serif" font-weight="700" font-size="24" fill="#ffffff" text-anchor="middle">S</text>
</svg>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, webPreferences: { offscreen: true } })
  const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`
  // Con offscreen el cuadro llega por el evento 'paint' (capturePage no pinta si la ventana está oculta)
  const painted = new Promise(resolve => win.webContents.once('paint', (_e, _dirty, image) => resolve(image)))
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  const img = await painted
  const out = path.join(__dirname, '..', 'build', 'icon.png')
  fs.writeFileSync(out, img.resize({ width: 512, height: 512 }).toPNG())
  console.log(`Ícono generado en ${out}`)
  app.quit()
})
