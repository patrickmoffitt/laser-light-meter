'use strict'

const path = require('path')
const fs = require('fs')
const SQL = require('sql.js')

let _rowsFromSqlDataObject = function (object) {
  let rows = {}
  let i = 0
  let j = 0
  for (let valueArray of object.values) {
    rows[i] = {}
    j = 0
    for (let column of object.columns) {
      rows[i][column] = valueArray[j]
      j++
    }
    i++
  }
  return rows
}

SQL.dbOpen = function (databaseFileName) {
  try {
    return new SQL.Database(fs.readFileSync(databaseFileName))
  } catch (error) {
    console.log("Can't open database file.", error.message)
    return null
  }
}

SQL.dbClose = function (databaseHandle, databaseFileName) {
  try {
    let data = databaseHandle.export()
    let buffer = new Buffer(data)
    fs.writeFileSync(databaseFileName, buffer)
    databaseHandle.close()
    return true
  } catch (error) {
    console.log("Can't close database file.", error)
    return null
  }
}

/*
  A function to create a new (empty) sqlite3 database.
*/
module.exports.initDb = function (appPath, callback) {
  let createDb = function (dbPath) {
    // Create a database.
    let db = new SQL.Database()
    let query = fs.readFileSync(
    path.join(__dirname, 'db', 'light_meter.sql'), 'utf8')
    let result = db.exec(query)
    if (Object.keys(result).length === 0 &&
      typeof result.constructor === 'function' &&
      SQL.dbClose(db, dbPath)) {
      console.log('Created a new database.')
    } else {
      console.log('model.initDb.createDb failed.')
    }
  }
  let metaCallback = function (callback) {
    if (typeof callback === 'function') {
      callback()
    }
  }
  let dbPath = path.join(appPath, 'light_meter.db')
  let db = SQL.dbOpen(dbPath)
  if (db === null) {
    /* The file doesn't exist so create a new database. */
    createDb(dbPath)
  } else {
    // The file is a valid sqlite3 database.
    let query = 'SELECT count(*) as `count` FROM `sqlite_master`'
    let row = db.exec(query)
    let tableCount = parseInt(row[0].values)
    if (tableCount === 0) {
      console.log('The file is an empty SQLite3 database.')
      createDb(dbPath)
    } else {
      console.log('The database has', tableCount, 'tables.')
    }
    metaCallback(callback)
  }
}

/* YYYY-MM-DD */
var _dateStringToEpochSecondsLocal = function (dateString) {
  let tokens = dateString.replace(/"/gm, '').split('-')
  let date = new Date(parseInt(tokens[0]), parseInt(tokens[1] - 1), parseInt(tokens[2]))
  return date.getTime() / 1000
}

module.exports.updateFormWithData = function (formId, keyValue, callback) {
  let db = SQL.dbOpen(window.config.db)
  if (db !== null) {
    let columns = view.getFormFieldNames(formId)
    let query = 'SELECT `' + columns.join('`, `') + '` FROM `' + formId
    query += '` WHERE `' + keyValue[0] + '` is "' + keyValue[1] + '"'
    try {
      let row = db.exec(query)
      if (row !== undefined && row.length > 0) {
        row = _rowsFromSqlDataObject(row[0])
        keyValue = Object.keys(row[0]).map(function (value, index) {
          return [value, row[0][value]]
        })
        view.setFormFieldValues(keyValue, callback)
      }
    } catch (error) {
      console.log('model.updateFormWithData', error.message)
    } finally {
      SQL.dbClose(db, window.config.db)
    }
  }
}

module.exports.saveFormData = function (formId, keyValue, callback) {
  if (keyValue.length > 0) {
    let db = SQL.dbOpen(window.config.db)
    if (db !== null) {
      let columns = []
      let values = []
      for (let pair of keyValue) {
        // Hide this password field from the model so it won't be stored.
        if (pair[0] !== 'rcmd-password') {
          columns.push(pair[0])
          values.push(pair[1])
        }
      }
      let query = 'INSERT OR REPLACE INTO `' + formId
      query += '` (`' + columns.join('`, `') + '`)'
      query += ' VALUES ("' + values.join('", "') + '")'
      query = query.replace(/("[\d]{4}-[\d]{2}-[\d]{2}")/, function (v) {
        return _dateStringToEpochSecondsLocal(v)
      })
      try {
        db.exec(query)
        $('#' + columns.join(', #')).addClass('form-control-success')
      } catch (error) {
        console.log('model.saveFormData', error.message)
      } finally {
        SQL.dbClose(db, window.config.db)
        if (typeof callback === 'function') {
          callback()
        }
      }
    }
  }
}

module.exports.saveModelData = function (formId, modelData, callback) {
  if (Object.keys(modelData).length !== 0) {
    // Hide this password field from the model so it won't be stored.
    delete modelData['rcmd-password']
    let db = SQL.dbOpen(window.config.db)
    if (db !== null) {
      let columns = Object.keys(modelData)
      let values = Object.keys(modelData).map(function (key) {
        return modelData[key]
      })
      let query = 'INSERT OR REPLACE INTO `' + formId
      query += '` (`' + columns.join('`, `') + '`)'
      query += ' VALUES ("' + values.join('", "') + '")'
      query = query.replace(/("[\d]{4}-[\d]{2}-[\d]{2}")/, function (v) {
        return _dateStringToEpochSecondsLocal(v)
      })
      try {
        db.exec(query)
        if (typeof callback === 'function') {
          callback()
        }
      } catch (error) {
        console.log('model.saveModelData', error.message)
      } finally {
        SQL.dbClose(db, window.config.db)
      }
    }
  }
}

module.exports.operatorSelect = function (selectedLabel) {
  let db = SQL.dbOpen(window.config.db)
  if (db !== null) {
    let query = 'SELECT `operator-id`, `username` FROM `operator`'
    query += ' ORDER BY `username` ASC'
    try {
      let rows = db.exec(query)
      let values = []
      let labels = []
      if (rows.length > 0) {
        rows = _rowsFromSqlDataObject(rows[0])
        for (let id in rows) {
          values.push(rows[id]['operator-id'])
          labels.push(rows[id]['username'])
        }
      }
      $('#operator-select').html(view.getSelectOptions(values, labels))
      $('#compare-operator-select').html(view.getSelectOptions(values, labels))
      if (selectedLabel !== undefined) {
        view.selectOptionByLabel('operator-select', selectedLabel)
        view.selectOptionByLabel('compare-operator-select', selectedLabel)
        $('#operator-username, #train-operator').html(selectedLabel)
      }
    } catch (error) {
      console.log('model.operatorSelect', error.message)
    } finally {
      SQL.dbClose(db, window.config.db)
    }
  }
}

module.exports.meterSelect = function (selectedLabel) {
  let db = SQL.dbOpen(window.config.db)
  if (db !== null) {
    let query = 'SELECT `meter-id`, `meter-name`'
    query += ' FROM `meter` ORDER BY `meter-name` ASC'
    try {
      let rows = db.exec(query)
      let values = []
      let labels = []
      if (rows.length > 0) {
        rows = _rowsFromSqlDataObject(rows[0])
        for (let id in rows) {
          values.push(rows[id]['meter-id'])
          labels.push(rows[id]['meter-name'])
        }
      }
      $('#meter-select').html(view.getSelectOptions(values, labels))
      if (selectedLabel !== undefined) {
        view.selectOptionByLabel('meter-select', selectedLabel)
      }
    } catch (error) {
      console.log('model.meterSelect', error.message)
    } finally {
      SQL.dbClose(db, window.config.db)
    }
  }
}

module.exports.laserSelect = function (selectedLabel) {
  let db = SQL.dbOpen(window.config.db)
  if (db !== null) {
    let query = 'SELECT `laser-id`, `laser-host-id` FROM `laser` ORDER BY `laser-id` ASC'
    try {
      let rows = db.exec(query)
      let values = []
      let labels = []
      if (rows.length > 0) {
        rows = _rowsFromSqlDataObject(rows[0])
        for (let id in rows) {
          values.push(rows[id]['laser-host-id'])
          labels.push(rows[id]['laser-id'])
        }
      }
      $('#compare-laser-select').html(view.getSelectOptions(values, labels))
      $('#laser-select').html(view.getSelectOptions(values, labels))
      if (selectedLabel !== undefined) {
        view.selectOptionByLabel('compare-laser-select', selectedLabel)
        view.selectOptionByLabel('laser-select', selectedLabel)
      }
    } catch (error) {
      console.log('model.laserSelect', error.message)
    } finally {
      SQL.dbClose(db, window.config.db)
    }
  }
}

module.exports.laserHostSelect = function (selectedLabel) {
  let db = SQL.dbOpen(window.config.db)
  if (db !== null) {
    let query = 'SELECT `host-id`, `hostname` FROM `laser-host`'
    query += ' ORDER BY `hostname` ASC'
    try {
      let rows = db.exec(query)
      let values = []
      let labels = []
      if (rows.length > 0) {
        rows = _rowsFromSqlDataObject(rows[0])
        for (let id in rows) {
          values.push(rows[id]['host-id'])
          labels.push(rows[id]['hostname'])
        }
      }
      $('#laser-host-select').html(view.getSelectOptions(values, labels))
      $('#host-select').html(view.getSelectOptions(values, labels))
      if (selectedLabel !== undefined) {
        view.selectOptionByLabel('laser-host-select', selectedLabel)
        view.selectOptionByLabel('host-select', selectedLabel)
      }
    } catch (error) {
      console.log('model.laserHostSelect', error.message)
    } finally {
      SQL.dbClose(db, window.config.db)
    }
  }
}

module.exports.modelSelect = function (selectedLaserId) {
  let laserId = parseInt(selectedLaserId)
  if (!Number.isNaN(laserId)) {
    let db = SQL.dbOpen(window.config.db)
    if (db !== null) {
      let query = 'SELECT `model-id` FROM `model`'
      query += ' WHERE `laser-id` is ' + laserId
      query += ' ORDER BY `model-id` DESC'
      try {
        let rows = db.exec(query)
        let values = []
        let labels = []
        if (rows.length > 0) {
          rows = _rowsFromSqlDataObject(rows[0])
          for (let id in rows) {
            values.push(rows[id]['model-id'])
            labels.push(view.epochSecondsToDateString(rows[id]['model-id'], true))
          }
        }
        $('#model-select').html(view.getSelectOptions(values, labels))
        $('#sample-select').html(view.getSelectOptions(values, labels))
        if (selectedLaserId !== undefined) {
          $('#compare-laser-select').val(selectedLaserId)
          $('#laser-host-select').val(selectedLaserId)
          $('#host-select').val(selectedLaserId)
        }
      } catch (error) {
        console.log('model.modelSelect', error.message)
      } finally {
        SQL.dbClose(db, window.config.db)
      }
    }
  }
}

module.exports.compareSelect = function (modelId, sampleId, callback) {
  modelId = parseInt(modelId)
  sampleId = parseInt(sampleId)
  if (!Number.isNaN(modelId) && !Number.isNaN(sampleId)) {
    let db = SQL.dbOpen(window.config.db)
    if (db !== null) {
      let query = 'SELECT * FROM `compare`'
      query += ' WHERE `knn-model-id` is ' + parseInt(modelId)
      query += ' AND `sample-model-id` is ' + parseInt(sampleId)
      try {
        let rows = db.exec(query)
        if (typeof callback === 'function') {
          if (rows.length === 0) {
            callback(rows)
          } else {
            callback(_rowsFromSqlDataObject(rows[0])[0])
          }
        }
      } catch (error) {
        console.log('model.compareSelect', error.message)
      } finally {
        SQL.dbClose(db, window.config.db)
      }
    }
  } else {
    console.log('Error: an input is NaN in model.compareSelect.')
  }
}

module.exports.saveModelComparisonData = function (formId, modelData) {
  if (Object.keys(modelData).length !== 0) {
    let db = SQL.dbOpen(window.config.db)
    if (db !== null) {
      let columns = Object.keys(modelData)
      let values = Object.keys(modelData).map(function (key) {
        return modelData[key]
      })
      let query = 'INSERT OR REPLACE INTO `' + formId
      query += '` (`' + columns.join('`, `') + '`)'
      query += ' VALUES ("' + values.join('", "') + '")'
      try {
        db.exec(query)
      } catch (error) {
        console.log('', error.message)
      } finally {
        SQL.dbClose(db, window.config.db)
      }
    }
  }
}
