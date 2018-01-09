'use strict'

const path = require('path')

module.exports.db = path.join(window.app.getPath('userData'), 'light_meter.db')
