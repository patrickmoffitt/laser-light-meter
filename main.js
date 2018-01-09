'use strict'

const electron = require('electron')
const app = electron.app
const globalShortcut = electron.globalShortcut
const os = require('os')
const path = require('path')
const config = require(path.join(__dirname, 'package.json'))
const model = require(path.join(__dirname, 'app', 'model.js'))

app.setName(config.productName)
const BrowserWindow = electron.BrowserWindow
var mainWindow = null
app.on('ready', function () {
  mainWindow = new BrowserWindow({
    backgroundColor: '#c9d9e2',
    title: config.productName,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      defaultEncoding: 'UTF-8'
    }
  })

  model.initDb(app.getPath('userData'),
    // Load a DOM stub here. See renderer.js for the fully composed DOM.
    mainWindow.loadURL(`file://${__dirname}/app/html/head.html`)
  )

  let platform = os.platform()
  if (platform === 'darwin') {
    globalShortcut.register('Command+Option+I', () => {
      mainWindow.webContents.openDevTools()
    })
  } else if (platform === 'linux' || platform === 'win32') {
    globalShortcut.register('Control+Shift+I', () => {
      mainWindow.webContents.openDevTools()
    })
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.setMenu(null)
    mainWindow.show()
  })

  mainWindow.onbeforeunload = (e) => {
    // Prevent Command-R from unloading the window contents.
    e.returnValue = false
  }

  mainWindow.on('closed', function () {
    mainWindow = null
  })

  mainWindow.on('page-title-updated', function (event) {
    event.preventDefault()
  })
})

app.on('window-all-closed', () => { app.quit() })
