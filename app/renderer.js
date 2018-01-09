'use strict'

const path = require('path')
const fs = require('fs')
const cheerio = require('cheerio')
const treeKill = require('treekill')
window.path = path
const remote = require('electron').remote
window.remote = remote
window.app = require('electron').remote.app
window.$ = window.jQuery = require('jquery')
window.Tether = require('tether')
window.Bootstrap = require('bootstrap')
window.SQL = require('sql.js')

// Compose the DOM from separate HTML concerns.
let htmlPath = path.join(app.getAppPath(), 'app', 'html')
let menu = fs.readFileSync(path.join(htmlPath, 'menu.html'), 'utf8')
let body = fs.readFileSync(path.join(htmlPath, 'body.html'), 'utf8')
let contentList = [
  'welcome.html',
  'compare.html',
  'train.html',
  'laser-host.html',
  'laser.html',
  'meter.html',
  'operator.html'
]
let content = ''
for (let file of contentList) {
  content += fs.readFileSync(path.join(htmlPath, file), 'utf8')
}

let O = cheerio.load(body)
O('#nav').append(menu)
O('#content').append(content)
let dom = O.html()
// Pass DOM from Cheerio to jQuery.
$('body').html(dom)

let webRoot = path.dirname(__dirname)
window.config = require(path.join(webRoot, 'config.js'))
window.view = require(path.join(webRoot, 'view.js'))
window.model = require(path.join(webRoot, 'model.js'))
window.controller = require(path.join(webRoot, 'controller.js'))

$('window').ready(function () {
  /* Operator form initial setup. */
  window.model.operatorSelect()
  /* Meter form initial setup. */
  model.meterSelect()
  /* Laser form initial setup. */
  model.laserHostSelect()
  model.laserSelect()
  if (window.controller.getPythonPath() === null) {
    let options = {
      title: 'Python?',
      type: 'info',
      message: 'Python version 3+ not found.\nPlease install it.',
      buttons: []
    }
    remote.dialog.showMessageBox(view.currentWindow, options)
  }
  window.controller.initPythonWin32(window.controller.getPythonDepends())
})

$(window).resize(function (e) {
  $('#train-status').height(parseInt($(e.target).height() * 0.6))
})

/*
  Users should see this dialog when attempting to
  quit while a data collection job is running.
*/
let _showCancelDialog = function () {
  let options = {
    title: 'Quit ' + config.productName + ' ?',
    message: 'Data collection is running. Do you really want to quit?',
    buttons: [
      'Cancel',
      'Quit'
    ]
  }
  let currentWindow = remote.getCurrentWindow()
  return remote.dialog.showMessageBox(currentWindow, options)
}
window.onbeforeunload = function (e) {
  if (window.controller.dataCollectionIsRunning()) {
    if (_showCancelDialog() === 1) {
      let processList = window.controller.pythonPids()
      for (let pid of processList) {
        treeKill(pid)
      }
    } else {
      e.returnValue = false
    }
  }
}
