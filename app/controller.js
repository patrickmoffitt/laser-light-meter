'use strict'

const path = require('path')
let webRoot = path.dirname(__dirname)
const config = require(path.join(webRoot, 'package.json'))
const execSync = require('child_process').execSync
const spawn = require('child_process').spawn
const os = require('os')
const fs = require('fs')
const app = require('electron').remote.app

let _utf8ArrayToStr = function (array) {
  let out, i, len, c, char2, char3
  out = ''
  len = array.length
  i = 0
  while (i < len) {
    c = array[i++]
    switch (c >> 4) {
      case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c)
        break
      case 12: case 13:
        // 110x xxxx   10xx xxxx
        char2 = array[i++]
        out += String.fromCharCode(
          ((c & 0x1F) << 6) |
          (char2 & 0x3F)
        )
        break
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++]
        char3 = array[i++]
        out += String.fromCharCode(
          ((c & 0x0F) << 12) |
          ((char2 & 0x3F) << 6) |
          ((char3 & 0x3F) << 0)
        )
        break
    }
  }
  return out
}

function _addSlashes (string) {
  return string.replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0')
}

module.exports.getPythonAppDir = function () {
  if (os.platform() === 'win32') {
    return path.join(app.getPath('userData'), 'python')
  } else {
    return path.join(__dirname, 'python')
  }
}

module.exports.initPythonWin32 = function (callback) {
  if (os.platform() === 'win32') {
    let pythonFileSystemDir = path.join(app.getPath('userData'), 'python')
    try {
      // This will throw if it fails. If it works there is nothing to do.
      fs.accessSync(pythonFileSystemDir, fs.constants.F_OK)
      if (typeof callback === 'function') {
        callback()
      }
    } catch (error) {
      console.log(error.message, 'Creating pythonFileSystemDir', pythonFileSystemDir)
      let pythonAsarDir = path.join(__dirname, 'python')
      fs.mkdirSync(pythonFileSystemDir, '0644')
      fs.readdir(pythonAsarDir, (error, files) => {
        if (error) {
          console.log(error)
          return false
        }
        let type = ''
        let source = ''
        let target = ''
        for (let file of files) {
          type = path.basename(file).split('.')[1]
          if (type === 'py') {
            source = path.join(pythonAsarDir, file)
            target = path.join(pythonFileSystemDir, path.basename(file))
            fs.createReadStream(source).pipe(fs.createWriteStream(target))
          }
        }
      })
      if (typeof callback === 'function') {
        callback()
      }
    }
  }
}

module.exports.dataCollectionIsRunning = function () {
  let platform = os.platform()
  let command = null
  let status = false
  /* Count will be off by plus 2. The process count includes the command itself
     plus the grep, or find it spawns. */
  if (platform === 'darwin' || platform === 'linux') {
    command = 'ps ax | grep -c "collect_random_data.py"'
  } else if (platform === 'win32') {
    command = 'WMIC path win32_process get Commandline | find /i ' +
    '"collect_random_data.py" /c'
  }
  if (command !== null) {
    try {
      let count = parseInt(_utf8ArrayToStr(execSync(command, {})))
      if (count > 2) {
        status = true
      }
      return status
    } catch (e) {
      console.log('controller.dataCollectionIsRunning:', e)
    }
  }
}

module.exports.pythonPids = function () {
  let platform = os.platform()
  let command = null
  let pattern = null
  let pids = new Array(0)
  let files = fs.readdirSync(path.join(__dirname, 'python'), {})
  if (platform === 'darwin' || platform === 'linux') {
    pattern = '"' + files.join('|') + '"'
    command = 'pgrep -fd ' + '"," ' + pattern
    try {
      let output = _utf8ArrayToStr(execSync(command, {})).split(',')
      for (let token of output) {
        pids.push(parseInt(token))
      }
      return pids
    } catch (e) {
      /* When the command has no return it fails. */
    }
  } else if (platform === 'win32') {
    pattern = '"' + files.join(' ') + '"'
    command = 'WMIC path win32_process get Processid | find /i ' +
    pattern + ' /c'
    try {
      let output = _utf8ArrayToStr(execSync(command, {})).split(' ')
      for (let token of output) {
        if (!isNaN(token)) {
          pids.push(token)
        }
      }
      return pids
    } catch (e) {
      console.log('controller.pythonPids:', e)
    }
  }
}

module.exports.getPythonDepends = function () {
  let path = controller.getPythonPath()
  let pyDir = controller.getPythonAppDir()
  let script = window.path.join(pyDir, 'check_depends.py')
  let cd = spawn(path.pythonBin, [script], {
    cwd: pyDir,
    env: {
      PATH: path.pythonPath + path.delimiter + process.env.PATH,
      PYTHONIOENCODING: 'utf-8'
    }
  })
  cd.stderr.on('data', (data) => {
    let options = {
      title: 'Python Modules?',
      type: 'info',
      message: _utf8ArrayToStr(data),
      buttons: []
    }
    window.remote.dialog.showMessageBox(view.currentWindow, options)
  })
  cd.on('close', (code) => {
    console.log('controller.getPythonDepends child ' +
      `process exited with code ${code}`)
  })
}

module.exports.setLaserPwmConfig = function (host, user, password) {
  let path = controller.getPythonPath()
  let pyDir = controller.getPythonAppDir()
  let script = window.path.join(pyDir, 'jq.py')
  let jq = spawn(path.pythonBin, [script, '-p', password, host, user,
    '.config.laser | {path,polarity,duty,period}',
    '/home/ubuntu/Development/cups_driver/src/CNC/CNC/Configs/pkm_config.json'
  ], {
    cwd: pyDir,
    env: {
      PATH: path.pythonPath + path.delimiter + process.env.PATH,
      PYTHONIOENCODING: 'utf-8'
    }
  })
  jq.stdout.on('data', (data) => {
    let pwm = JSON.parse(data)
    $('#period').html(pwm.period)
    $('#duty-cycle').html(pwm.duty)
    /* The firing time is a multiple of the period. The value also depends upon
    the size of the light meter's ring buffer and it's sampling rate. As it happens,
    seven periods fits nicely into a ring buffer of 1000 at 77 KHz. */
    $('#firing-time').html(pwm.period * config.firingTimeFactor)
  })
  jq.stderr.on('data', (data) => {
    console.log(_utf8ArrayToStr(data))
  })
  jq.on('close', (code) => {
    console.log('controller.setLaserPwmConfig child ' +
      `process exited with code ${code}`)
  })
}

module.exports.collectData = function (cfg, modelData) {
  // controller.dataCollectionIsRunning = true
  let platform = os.platform()
  let tty = ''
  if (platform === 'darwin') {
    tty = '/dev/cu.usbmodem1421'
  } else if (platform === 'linux') {
    tty = '/dev/ttyACM0'
  } else if (platform === 'win32') {
    tty = 'COM4'
  }
  let userData = app.getPath('userData')
  let path = controller.getPythonPath()
  let pyDir = controller.getPythonAppDir()
  let script = window.path.join(pyDir, 'collect_random_data.py')
  if (cfg['su-password'] === '') {
    cfg['su-password'] = JSON.stringify(cfg['su-password'])
  }
  if (platform === 'win32') {
    userData = _addSlashes(userData)
    script = _addSlashes(script)
  } else {
    userData = app.getPath('userData')
  }
  let cd = spawn(path.pythonBin, [script, cfg.host, cfg.password,
    cfg['su-password'], '-d', userData, '-u', cfg.user, '--min',
    cfg.min, '--max', cfg.max, '-s', cfg.samples, '-t', tty
  ], {
    cwd: pyDir,
    env: {
      PATH: controller.getPythonPath() + path.delimiter + process.env.PATH,
      PYTHONIOENCODING: 'utf-8'
    }
  })
  let json = ''
  cd.stdout.on('data', (data) => {
    data = _utf8ArrayToStr(data)
    if (cfg['samples-dir'] === '') {
      try {
        json = JSON.parse(data)
        cfg['samples-dir'] = json.data_dir
        modelData['model-id'] = json.model_id
      } catch (SyntaxError) {
        console.log('Failed to set cfg.samples_dir and modelData.model_id ' +
        ' in controller.collectData.')
      }
    } else {
      $('#train-status').append(data).scrollTop(
        $('#train-status')[0].scrollHeight
      )
    }
  })
  cd.stderr.on('data', (data) => {
    $('#train-status').append(_utf8ArrayToStr(data)).scrollTop(
      $('#train-status')[0].scrollHeight
    )
  })
  cd.on('close', (code) => {
    console.log(`controller.collectData child process exited with code ${code}`)
    this.trainModel(cfg, modelData)
  })
}

module.exports.trainModel = function (cfg, modelData) {
  let path = controller.getPythonPath()
  let pyDir = controller.getPythonAppDir()
  let script = window.path.join(pyDir, 'train_model.py')
  let tm = spawn(path.pythonBin, [script, '-d', cfg['samples-dir']], {
    cwd: pyDir,
    env: {
      PATH: controller.getPythonPath() + path.delimiter + process.env.PATH,
      PYTHONIOENCODING: 'utf-8'
    }
  })
  let json = ''
  tm.stdout.on('data', (data) => {
    data = _utf8ArrayToStr(data)
    if (modelData.model === null) {
      try {
        json = JSON.parse(data)
        modelData.samples = json.samples
        modelData.model = json.model
        modelData['cross-validation-accuracy'] = json['cross-validation-accuracy']
        modelData['cross-validation-error'] = json['cross-validation-error']
        modelData['cross-validation-neighbors'] = json['cross-validation-neighbors']
        modelData['cross-validation-folds'] = json['cross-validation-folds']
        modelData['standard-error-estimate'] = json['standard-error-estimate']
      } catch (SyntaxError) {
        console.log('Failed to set modelData variables in controller.trainModel.')
        $('#train-status').append(data).scrollTop(
          $('#train-status')[0].scrollHeight
        )
      }
    }
  })
  tm.stderr.on('data', (data) => {
    $('#train-status').append(_utf8ArrayToStr(data)).scrollTop(
      $('#train-status')[0].scrollHeight
    )
  })
  tm.on('close', (code) => {
    // controller.dataCollectionIsRunning = false
    console.log(`controller.trainModel child process exited with code ${code}`)
    model.saveModelData(cfg.formId, modelData, function () {
      $('#train-status').append('\n' +
        '┌───────────────────┐\n' +
        '│ Training Complete │\n' +
        '└───────────────────┘\n').scrollTop(
        $('#train-status')[0].scrollHeight
      )
    })
  })
}

module.exports.getModelPrediction = function (formId, modelData) {
  let path = controller.getPythonPath()
  let pyDir = controller.getPythonAppDir()
  let script = window.path.join(pyDir, 'prediction.py')
  let mp = spawn(path.pythonBin, [script, modelData['knn-model-id'],
    modelData['sample-model-id'],
    modelData['operator-id'],
    '-d', app.getPath('userData')], {
      cwd: pyDir,
      env: {
        PATH: controller.getPythonPath() + path.delimiter + process.env.PATH,
        PYTHONIOENCODING: 'utf-8',
        QT_QPA_PLATFORM: 'offscreen'
      }
    })
  let json = ''
  mp.stdout.on('data', (data) => {
    data = _utf8ArrayToStr(data)
    if (modelData['host-name'] === null) {
      try {
        json = JSON.parse(data)
        modelData['host-name'] = json['host-name']
        modelData['date'] = json.date
        modelData['error-proba-mean'] = json['error-proba-mean']
        modelData['error-proba-std-dev'] = json['error-proba-std-dev']
        modelData['error-proba-std-err-mean'] = json['error-proba-std-err-mean']
        modelData['error-proba-variance'] = json['error-proba-variance']
        modelData['error-proba-bins'] = json['error-proba-bins']
        modelData['prediction-score'] = json['prediction-score']
        modelData['std-err-estimate'] = json['std-err-estimate']
        modelData['predict-proba'] = json['predict-proba']
        modelData['proba-dist-chart'] = json['proba-dist-chart']
        modelData['mean-variance-chart'] = json['mean-variance-chart']
        view.displayCompareData(Object.assign({}, modelData))
        model.saveModelComparisonData(formId, modelData)
      } catch (SyntaxError) {
        console.log('Failed to set modelData variables in ' +
          ' controller.getModelPrediction.')
      }
    }
  })
  mp.stderr.on('data', (data) => {
    console.log(_utf8ArrayToStr(data))
  })
  mp.on('close', (code) => {
    console.log(`controller.getModelPrediction child process exited with code ${code}`)
  })
}

module.exports.getPythonPath = function () {
  let platform = os.platform()
  let which = null
  let pythonPath = ''
  let pythonBin = ''
  let python = ''
  let version = null
  let v = null
  let options = null
  let delimiter = ':'
  if (platform === 'darwin') {
    options = {
      env: { PATH: '/usr/local/bin' + path.delimiter + process.env.PATH }
    }
    which = 'which python3'
    try {
      python = _utf8ArrayToStr(execSync(which, options)).replace(/\r?\n|\r/g, '')
      version = python + ' -V'
      v = parseInt(_utf8ArrayToStr(
        execSync(version, options)).split(' ')[1].split('.')[0])
      if (v === 3) {
        pythonPath = python
        pythonBin = pythonPath.replace(/\r?\n|\r/g, '')
      }
    } catch (e) {}
  } else if (platform === 'linux') {
    options = {
      env: { PATH: '/usr/bin' + path.delimiter + process.env.PATH }
    }
    which = 'which python3'
    try {
      python = _utf8ArrayToStr(execSync(which, options)).replace(/\r?\n|\r/g, '')
      version = python + ' -V'
      v = parseInt(_utf8ArrayToStr(
        execSync(version, options)).split(' ')[1].split('.')[0])
      if (v === 3) {
        pythonPath = python
        pythonBin = pythonPath.replace(/\r?\n|\r/g, '')
      }
    } catch (e) {}
  } else if (platform === 'win32') {
    delimiter = ';'
    which = 'where python3'
    try {
      python = _utf8ArrayToStr(execSync(which, {})).replace(/\r?\n|\r/g, '')
      if (python.length > 0) {
        pythonPath = python
        pythonBin = pythonPath.replace(/\r?\n|\r/g, '')
      }
    } catch (e) {
      try {
        which = 'where python'
        python = _utf8ArrayToStr(execSync(which, {})).replace(/\r?\n|\r/g, '')
        if (python.length > 0) {
          try {
            version = '"' + python + '" -V 2>&1'
            v = parseInt(_utf8ArrayToStr(
              execSync(version, {})).split(' ')[1].split('.')[0])
            if (v === 3) {
              pythonPath = python
              pythonBin = pythonPath.replace(/\r?\n|\r/g, '')
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
  }
  if (pythonPath.length > 0) {
    return {
      pythonPath: path.dirname(pythonPath.replace(/\r?\n|\r/g, '')),
      pythonBin: pythonBin,
      delimiter: delimiter
    }
  }
}
