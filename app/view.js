'use strict'

const os = require('os')
const fs = require('fs')
const path = require('path')
const electron = require('electron').remote
const globalShortcut = electron.globalShortcut
const BrowserWindow = electron.BrowserWindow

module.exports.currentWindow = electron.getCurrentWindow()

/* General View utility functions. */
module.exports.capitalizeFirstLetter = function (word) {
  if (word !== undefined) {
    return word.charAt(0).toUpperCase() + word.slice(1)
  }
}

module.exports.epochSecondsToDateString = function (epochSeconds, time = false) {
  let seconds = parseInt(epochSeconds) * 1000
  if (isNaN(seconds)) {
    console.log('Invalid value passed to view.epochSecondsToDateString:', epochSeconds)
    seconds = 0
  }
  let dateObj = new Date(seconds)
  let dateString = dateObj.getFullYear() + '-'
  dateString += this.stringPad('00', dateObj.getMonth() + 1, true) + '-'
  dateString += this.stringPad('00', dateObj.getDate(), true)
  if (time) {
    let m = ''
    let hour = dateObj.getHours()
    if (hour < 12) {
      m = ' AM'
    } else {
      m = ' PM'
    }
    if (hour === 0) {
      hour = 12
    }
    if (hour >= 13) {
      hour = hour - 12
    }
    dateString += ' ' + [
      this.stringPad('00', hour, true),
      this.stringPad('00', dateObj.getMinutes(), true)
    ].join(':')
    dateString += m
  }
  return dateString
}

module.exports.getFormFieldNames = function (formId) {
  let names = new Array(0) // Using = [] made the first push fail.
  $('#' + formId).find('input, textarea').each(function (idx, obj) {
    names.push($(obj).attr('id'))
  })
  /*
    Hide this password field from the model so it won't be queried.
    This field is not in the database. It only exists on the form at run time.
  */
  let searchIndex = names.lastIndexOf('rcmd-password')
  if (searchIndex !== -1) {
    names.splice(searchIndex, 1)
  }
  return names
}

module.exports.getFormFieldValues = function (formId) {
  let keyValue = []
  $('#' + formId).find('input:visible, textarea:visible').each(function (idx, obj) {
    keyValue.push([$(obj).attr('id'), $(obj).val()])
  })
  return keyValue
}

module.exports.getSelectOptions = function (values, labels) {
  let options = '<option selected>None</option>'
  let list = this.zip([values, labels])
  for (let pair of list) {
    options += '<option value="' + pair[0] + '">' + pair[1] + '</option>'
  }
  return options
}

module.exports.getValueBySelectOptionLabel = function (id, label) {
  return $('#' + id + ' option').filter(function () {
    return $(this).text() === label
  }).val()
}

module.exports.selectOptionByLabel = function (selectId, label) {
  $('#' + selectId + ' option').each(function (idx, obj) {
    if ($(obj).text() === label) {
      $(obj).prop('selected', true)
    }
  })
}

module.exports.setFormFieldValues = function (keyValue, callback) {
  for (let pair of keyValue) {
    if (pair[0].match(/-date$/) !== null) {
      pair[1] = view.epochSecondsToDateString(pair[1])
    }
    $('#' + pair[0]).val(pair[1])
  }
  if (typeof callback === 'function') {
    callback()
  }
}

module.exports.showForm = function (formId) {
  $('#welcome').hide()
  $('form').hide()
  $('#' + formId).show()
}

module.exports.stringPad = function (pad, str, padLeft) {
  if (typeof str === 'undefined') {
    return pad
  }
  if (padLeft) {
    return (pad + str).slice(-pad.length)
  } else {
    return (str + pad).substring(0, pad.length)
  }
}

module.exports.zip = function (arrays) {
  return arrays[0].map(function (_, i) {
    return arrays.map(function (array) {
      return array[i]
    })
  })
}

/* Navigation Menu click event handler. */
$('#nav button').click(function (e) {
  $('#nav button').removeClass('active'); $(e.target).addClass('active')
})

/* Operator Menu event handlers. */
module.exports.showAddOperator = function () {
  $('#operator input').removeClass('form-control-success')
  $('#operator-select, #operator-id').parent().hide()
  $('#username, #operator-id').val('')
  $('#username, #operator-submit').parent().show()
  $('#operator-submit').html('Add')
  this.showForm('operator')
}

module.exports.showEditOperator = function () {
  $('#operator input').removeClass('form-control-success')
  let operator = $('#operator-username').html()
  $('#operator-id, #operator-select, #username, #operator-submit')
    .parent().show()
  $('#operator-submit').html('Update')
  if (operator !== 'None') {
    model.updateFormWithData('operator', ['username', operator])
    $('#username').removeAttr('readonly')
    $('#operator-submit').show()
  } else {
    $('#username, #operator-id').val('').attr('readonly', true)
    $('#operator-submit').hide()
  }
  this.showForm('operator')
  this.selectOptionByLabel('operator-select', operator)
}

module.exports.showSelectOperator = function () {
  let operator = $('#operator-username').html()
  this.selectOptionByLabel('operator-select', operator)
  $('#operator-select').parent().show()
  $('#operator-id, #username, #operator-submit').parent().hide()
  this.showForm('operator')
}

/* Keep operator usernames in Upper-Case-First format. */
$('#username').change(function (event) {
  let obj = $(event.target)
  obj.val(view.capitalizeFirstLetter(obj.val()))
})

/* Operator form initial setup. */
$('#operator-id, #operator-select').parent().hide()
$('#operator-select, #compare-operator-select').change(function (e) {
  let operator = $(e.target).find('option:selected').html()
  $('#operator-username').html(operator)
  view.selectOptionByLabel('operator-select', operator)
  view.selectOptionByLabel('compare-operator-select', operator)
  if (operator === 'None') {
    $('#username, #operator-id').val('').attr('readonly', true)
    $('#operator-submit').hide()
  } else {
    $('#operator-username, #train-operator').html(operator)
    $('#username').removeAttr('readonly')
    $('#operator-submit').show()
    model.updateFormWithData('operator', ['operator-id', $(e.target).val()])
  }
})

$('#operator-submit').click(function (e) {
  e.preventDefault()
  let operator = $('#username').val()
  let formId = $(e.target).parents('form').attr('id')
  let keyValue = view.getFormFieldValues(formId)
  model.saveFormData(formId, keyValue, function () {
    window.model.operatorSelect(operator)
  })
})

/* Meter Menu event handlers. */
module.exports.showAddMeter = function () {
  $('#meter input, #meter textarea').removeClass('form-control-success')
  $('#meter input, #meter textarea').val('')
  $('#meter input, #meter textarea, #meter-submit').parent().show()
  $('#meter-select, #meter-id').parent().hide()
  $('#meter-submit').html('Add')
  this.showForm('meter')
}

module.exports.showEditMeter = function () {
  $('#meter input, #meter textarea').removeClass('form-control-success')
  let meter = $('#selected-meter-name').html()
  $('#meter input, #meter-select, #meter-submit').parent().show()
  $('#meter-submit').html('Update')
  if (meter !== 'None') {
    model.updateFormWithData('meter', ['meter-name', meter])
  } else {
    $('#meter input, #meter textarea').val('').attr('readonly', true)
  }
  this.showForm('meter')
  this.selectOptionByLabel('meter-select', meter)
}

module.exports.showSelectMeter = function () {
  let meter = $('#selected-meter-name').html()
  $('#meter input, #meter-submit').parent().hide()
  $('#meter-description').val('')
  $('#meter-select, #meter-description').parent().show()
  model.updateFormWithData('meter', ['meter-name', meter])
  this.showForm('meter')
  this.selectOptionByLabel('meter-select', meter)
}

/* Meter form initial setup. */
$('#meter-id, #meter-select').parent().hide()
$('#meter-select').change(function (e) {
  let meter = $(e.target).find('option:selected').html()
  $('#meter input, #meter textarea').removeClass('form-control-success')
  $('#selected-meter-name').html(meter)
  $('#meter').find('input, textarea').val('')
  if (meter === 'None') {
    $('#meter').find('input, textarea').attr('readonly', true)
    $('#meter-submit').hide()
  } else {
    $('#train-meter').html(meter)
    $('#meter').find('input, textarea').removeAttr('readonly')
    $('#meter-submit').show()
    $('#meter-id').attr('readonly', true)
    model.updateFormWithData('meter', ['meter-id', $(e.target).val()])
  }
})
$('#meter-submit').click(function (e) {
  e.preventDefault()
  let meter = $('#meter-select option:selected').html()
  let formId = $(e.target).parents('form').attr('id')
  let keyValue = view.getFormFieldValues(formId)
  model.saveFormData(formId, keyValue, function () {
    model.meterSelect(meter)
  })
})

/* Laser Menu event handlers. */
module.exports.showAddLaser = function () {
  $('#laser input, #laser textarea').removeClass('form-control-success')
    .removeAttr('readonly')
  $('#laser input, #laser textarea').val('')
  $('#laser input, #laser textarea, #laaser-host-select, #laser p, #laser-submit')
    .parent().show()
  $('#laser-id, #laser-select, #laser-refurb-date').parent().hide()
  $('#laser-submit').html('Add')
  this.showForm('laser')
}

module.exports.showEditLaser = function () {
  $('#laser input, #laser textarea').removeClass('form-control-success')
  let laser = $('#selected-laser-id').html()
  $('#laser input, #laser textarea, #laser p, #laser-host-select').parent().show()
  $('#laser-submit').html('Update')
  if (laser !== 'None') {
    model.updateFormWithData('laser', ['laser-id', laser], view.laserPwmConfig)
  } else {
    $('#laser').find('input, textarea').val('').attr('readonly', true)
  }
  this.showForm('laser')
}

module.exports.showSelectLaser = function () {
  let laser = $('#selected-laser-id').html()
  $('#laser input, #laser textarea, #laser-host-select, #laser-submit, #laser p')
    .parent().hide()
  $('#laser-select').parent().show()
  model.updateFormWithData('laser', ['laser-id', laser], view.laserPwmConfig)
  this.showForm('laser')
}

module.exports.laserPwmConfig = function () {
  let missingData = 0
  let field = null
  for (field of ['ip-address', 'rcmd-user', 'rcmd-password']) {
    if ($('#' + field).val() === '') {
      $('#' + field).addClass('form-control-warning')
      missingData++
    } else {
      $('#' + field).removeClass('form-control-warning')
    }
  }
  if (missingData === 0) {
    let ip = $('#ip-address').val()
    let user = $('#rcmd-user').val()
    let password = $('#rcmd-password').val()
    controller.setLaserPwmConfig(ip, user, password)
  }
}

/* Laser form initial setup. */
$('#laser-select, #compare-laser-select').change(function (e) {
  let laserLabel = $(e.target).find('option:selected').html()
  let laserId = parseInt(laserLabel)
  let hostId = $(e.target).val()
  let hostname = $('#host-select option[value=' + hostId + ']').html()
  $('#compare-laser-select').val(laserId)
  $('#selected-laser-id').html(laserLabel)
  $('#laser input, #laser textarea').val('')
  $('#laser p').html('')
  if (laserLabel === 'None') {
    $('#laser input, #laser textarea').attr('readonly', true)
    $('#laser-submit').parent().hide()
    view.selectOptionByLabel('compare-laser-select', laserLabel)
    view.selectOptionByLabel('laser-host-select', laserLabel)
    $('#selected-laser-host').html(laserLabel)
    view.selectOptionByLabel('laser-host', laserLabel)
  } else {
    model.modelSelect(laserId)
    $('#train-laser').html(laserLabel)
    $('#laser-host-select').val(hostId)
    $('#selected-laser-host').html(hostname)
    view.selectOptionByLabel('host-select', hostname)
    $('#laser input, #laser textarea').removeAttr('readonly')
    $('#laser-submit').show()
    model.updateFormWithData('laser', ['laser-id', laserId])
    $('#laser-id').attr('readonly', true)
    model.updateFormWithData('laser-host', ['host-id', hostId], view.laserPwmConfig)
  }
})

$('#laser-submit').click(function (e) {
  e.preventDefault()
  let laserLabel = $('#laser-select option:selected').html()
  let formId = $(e.target).parents('form').attr('id')
  let selectedHostId = $('#laser-host-select').val()
  let keyValue = view.getFormFieldValues(formId)
  keyValue.push(['laser-host-id', selectedHostId])
  model.saveFormData(formId, keyValue, function () {
    model.laserSelect(laserLabel)
  })
})

/* Laser Host Menu event handlers. */
module.exports.showAddLaserHost = function () {
  $('#laser-host input, #laser-host textarea')
    .removeClass('form-control-success').removeAttr('readonly')
  $('#laser-host input').val('')
  $('#laser-host input, #laser-host-submit').parent().show()
  $('#host-id, #host-select').parent().hide()
  $('#laser-host-submit').html('Add')
  this.showForm('laser-host')
}

module.exports.showEditLaserHost = function () {
  $('#laser-host input').removeClass('form-control-success')
  let laserHost = $('#selected-laser-host').html()
  $('#laser-host input, #laser-host-submit').parent().show()
  $('#laser-host-submit').html('Update')
  if (laserHost !== 'None') {
    model.updateFormWithData('laser-host', ['hostname', laserHost], view.laserPwmConfig)
  } else {
    $('#laser-host').find('input').val('').attr('readonly', true)
    $('#laser-host-submit').parent().hide()
  }
  this.showForm('laser-host')
}

module.exports.showSelectLaserHost = function () {
  let laserHost = $('#selected-laser-host').html()
  $('#laser-host input, #laser-host-submit').parent().hide()
  $('#host-select').parent().show()
  model.updateFormWithData('laser-host', ['hostname', laserHost], view.laserPwmConfig)
  this.showForm('laser-host')
}

/* Host form initial setup. */
$('#laser-host-submit').click(function (e) {
  e.preventDefault()
  let laserHost = $('#selected-laser-host').html()
  let formId = $(e.target).parents('form').attr('id')
  let keyValue = view.getFormFieldValues(formId)
  model.saveFormData(formId, keyValue, function () {
    model.laserHostSelect(laserHost) // Also updates host select list.
  })
})

$('#host-select, #laser-host-select').change(function (e) {
  let host = $(e.target).find('option:selected').html()
  $('#selected-laser-host').html(host)
  view.selectOptionByLabel('laser-host', host)
  view.selectOptionByLabel('laser-host-select', host)
  $('#laser-host, #laser').find('input, textarea').val('')
  $('#laser p').html('')
  if (host === 'None') {
    $('#selected-laser-id').html(host)
    view.selectOptionByLabel('laser-select', host)
    $('#laser-host, #laser').find('input, textarea').attr('readonly', true)
    $('#laser-host-submit, #laser-submit').parent().hide()
  } else {
    $('#laser-host-select').val($(e.target).val())
    $('#laser-host, #laser').find('input').removeAttr('readonly')
    $('#host-id, #laser-id').attr('readonly', true)
    model.updateFormWithData('laser-host', ['host-id', $(e.target).val()], view.laserPwmConfig)
  }
})

/* Measure Menu event handlers. */
module.exports.showCompare = function () {
  model.modelSelect($('#laser-select').val())
  $('#compare div.form-group').show()
  this.showForm('compare')
}

module.exports.showTrain = function () {
  $('#model div.form-group').show()
  let platform = os.platform()
  if (platform === 'darwin' || platform === 'linux') {
    $('#su-password').parent().show()
  } else {
    $('#su-password').parent().hide()
  }
  $('#train-status').parent().hide()
  let missingData = 0
  for (let field of ['laser', 'meter', 'operator']) {
    if ($('#train-' + field).html() === '') {
      $('#train-' + field).addClass('form-control-warning')
      missingData++
    } else {
      $('#train-' + field).removeClass('form-control-warning')
    }
  }
  if (missingData === 0) {
    $('#train-submit').parent().show()
  } else {
    $('#train-submit').parent().hide()
  }
  this.showForm('model')
}

$('#rcmd-password').on('blur', function (e) {
  if ($(e.target).val().length > 0) {
    view.laserPwmConfig()
    $(e.target).removeClass('form-control-warning')
  }
})

module.exports.displayCompareData = function (modelData) {
  modelData['date'] = view.epochSecondsToDateString(modelData['date'], true)
  modelData['proba-dist-chart'] = '<a href="#" data-image="' +
  modelData['proba-dist-chart'] + '" onclick="view.showChart(\'chart\', ' +
  'this.dataset.image)">Line Chart</a>'
  modelData['mean-variance-chart'] = '<a href="#" data-image="' +
  modelData['mean-variance-chart'] + '" onclick="view.showChart(\'histogram\', ' +
  'this.dataset.image)">Histogram</a>'
  let key = null
  for (key of Object.keys(modelData)) {
    $('#' + key).html(modelData[key])
  }
  $('#compare-report').show()
}

$('#compare-submit').click(function (e) {
  e.preventDefault()
  let formValid = 0
  $('#compare option:selected').each(function (idx, obj) {
    let input = $(obj)
    if (input.val() === 'None') {
      input.parent().addClass('form-control-warning')
      formValid++
    } else {
      input.parent().removeClass('form-control-warning')
    }
  })
  if (formValid === 0) {
    let formId = $(e.target).parents('form').attr('id')
    let modelId = parseInt($('#model-select').val())
    let sampleId = parseInt($('#sample-select').val())
    let operatorId = parseInt($('#compare-operator-select').val())
    model.compareSelect(modelId, sampleId,
      function (rows) {
        if (Object.keys(rows).length > 0) {
          let modelData = {}
          modelData['host-name'] = rows['host-name']
          modelData['date'] = rows['date']
          modelData['operator-id'] = rows['operator-id']
          modelData['error-proba-mean'] = rows['error-proba-mean']
          modelData['error-proba-std-dev'] = rows['error-proba-std-dev']
          modelData['error-proba-std-err-mean'] = rows['error-proba-std-err-mean']
          modelData['error-proba-variance'] = rows['error-proba-variance']
          modelData['error-proba-bins'] = rows['error-proba-bins']
          modelData['prediction-score'] = rows['prediction-score']
          modelData['std-err-estimate'] = rows['std-err-estimate']
          modelData['predict-proba'] = rows['predict-proba']
          modelData['proba-dist-chart'] = rows['proba-dist-chart']
          modelData['mean-variance-chart'] = rows['mean-variance-chart']
          view.displayCompareData(modelData)
        } else {
          let modelData = {'sample-model-id': sampleId,
            'knn-model-id': modelId,
            'operator-id': operatorId,
            'host-name': null,
            'date': 0,
            'error-proba-mean': 0.0,
            'error-proba-std-dev': 0.0,
            'error-proba-std-err-mean': 0.0,
            'error-proba-variance': 0.0,
            'error-proba-bins': 0,
            'prediction-score': 0.0,
            'std-err-estimate': 0.0,
            'predict-proba': '',
            'proba-dist-chart': '',
            'mean-variance-chart': ''}
          controller.getModelPrediction(formId, modelData)
          // spawn a task to generate the prediction, store it, paint it, show it.
        }
      })
  }
})

$('#train-submit').click(function (e) {
  e.preventDefault()
  // Save the form data.
  let modelData = {
    'model-id': null,
    'laser-id': parseInt($('#train-laser').html()),
    'meter-id': parseInt(view.getValueBySelectOptionLabel('meter-select',
      $('#train-meter').html())),
    'operator-id': parseInt(view.getValueBySelectOptionLabel('operator-select',
      $('#train-operator').html())),
    'laser-host-id': parseInt($('#laser-host-select option:selected').val()),
    'model-host-name': os.hostname().split('.', 1)[0],
    'min-duty': parseInt($('#min-duty').val()),
    'max-duty': parseInt($('#max-duty').val()),
    'series': parseInt($('#series').val()),
    'cross-validation-accuracy': null,
    'cross-validation-error': null,
    'cross-validation-neighbors': null,
    'cross-validation-folds': null,
    'standard-error-estimate': null,
    'samples': null,
    'model': null
  }
  /* Spawn the data collection program. */
  let cfg = {
    'host': $('#ip-address').val(),
    'password': $('#rcmd-password').val(),
    'user': $('#rcmd-user').val(),
    'min': modelData['min-duty'],
    'max': modelData['max-duty'],
    'samples': modelData['series'],
    'su-password': $('#su-password').val(),
    'formId': $(e.target).parents('form').attr('id'),
    'samples-dir': ''
  }
  $('#model div.form-group').hide()
  $('#train-status').html('')
  $('#train-status').parent().show()
  /*
    controller.collectData has a callback to controller.trainModel
    after which modelData is stored in the database.
  */
  controller.collectData(cfg, modelData)
})

module.exports.showChart = function (type, file, options = {}) {
  let image = fs.readFileSync(file, 'utf8')
  let cheerio = require('cheerio')
  let O = cheerio.load(image)
  O('svg').attr({id: 'data-viz', style: 'transform: scale(1.65);'})
  options.show = true
  let display = function (object) {
    globalShortcut.register('CommandOrControl+P', (object) => {
      object.webContents.print({silent: false, printBackground: false})
    })
    object.loadURL('data:image/svg+xml;charset=utf-8,' + O.html())
    let script = fs.readFileSync(
      path.join(window.app.getAppPath(), 'app', 'chart.js'), 'utf8')
    object.webContents.executeJavaScript(script)
  }
  switch (type) {
    case 'chart':
      let lineChart = null
      options.title = 'Line Chart'
      lineChart = new BrowserWindow(options)
      display(lineChart)
      break
    case 'histogram':
      let histogram = null
      options.title = 'Histogram'
      histogram = new BrowserWindow(options)
      display(histogram)
      break
  }
}
