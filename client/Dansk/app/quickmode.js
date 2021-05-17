// Import the onoff Gpio library
const Gpio = require('onoff').Gpio
const request = require('request')
const fs = require('fs')

// Driver to barcode scanner
const barcode = require('usb-barcode-transform')
const path = require('path')
const player = require('play-sound')(opts = {})

// Database
const ProductInfo = require('../db/db').ProductInfo
const Cached = require('../db/db').Cached
const Settings = require('../db/db').Settings

// Initialize pin 21 in input mode, 'both' means we want to handle both rising and falling interrupt edges
const pirSensor = new Gpio(21, 'in', 'both')

const decompress = require('decompress')
const audiosprite = require('audiosprite')
const voice_cache_path = path.join(__dirname, '../cache/voice/')


// Server's domain
const GoScanServer = 'http://www.coskun.ch/goscan/'

// Proximity sensor
function motionDetector () {
  // Checks for motion
  pirSensor.watch((err, sensorValue) => {
    console.log(sensorValue)
    if (err) exit(err)
    // Motion detected
    if (sensorValue) {
      // Deactivate sensor
      pirSensor.unwatch()
      readBarcode()
    }
  })
}

// Read barcode from scanner
function readBarcode () {
  // Stream from barcode scanner
  const stream = fs.createReadStream('/dev/input/by-id/usb-YK_YK-2D_PRODUCT_HID_KBW_MS001-000000000-event-kbd', {
    flags: 'r',
    encoding: null,
    fd: null,
    autoClose: true
  })

  stream
    .pipe(new barcode.Scanner())
    .pipe(new barcode.Group())
    .on('data', (data) => {
      // Prevents scanning multiple times
      stream.destroy()
      getProductInfo(data)
    })
}


// Get product info
function getProductInfo (readBarcode) {
  let voices = new Map()

  const enabledOptions = Settings.enabledOptions()

  if (enabledOptions.length === 0) {
    player.play(path.join(__dirname, '../audio/status/no_options.mp3'), (err) => {
      if (err) console.log(`Could not play sound: ${err}`)
      return motionDetector()
    })
  }

  // Request product info
  const options = {
    uri: GoScanServer + 'quickmode/',
    method: 'POST',
    encoding: null,
    json: {
      'barcode': readBarcode.toString('utf8'),
      'voice_for': []
    }
  }

  let allergens = false

  for (let o of enabledOptions) {
    // Check if voice is already stored on disk
    const cachedVoice = Cached.cachedVoices({barcode: readBarcode.toString('utf8'), voice_for: o['option']})
    if (o['option'] === 'allergens') {
      allergens = true
      continue
    }
    
    if (!cachedVoice) {
      options.json.voice_for.push(o['option'])
    }
    else {
      voices.set(cachedVoice.voice_for, voice_cache_path + cachedVoice.voice_for + '/' + cachedVoice.barcode + cachedVoice.file_type)
    }
  }

  if (options.json.voice_for.length) {
    // Request voice file
    request(options, (error, response, body) => {
      const archive_path = voice_cache_path
      const file_path = archive_path + 'files.tar'
      
      if (!error && response.statusCode === 200) {
        // Write the binary audio content to a local file
        fs.writeFile(file_path, body, 'binary', err => {
          if (err) {
            console.error('ERROR:', err)
            return
          }
        decompress(file_path, archive_path).then(files => {
          for (let file of files) {
            const file_info = file.path.split('/')
            const voice_for = file_info[0]
            const barcode = file_info[1].split('.')[0]
            const file_type = '.' + file_info[1].split('.')[1]
            if (voice_for !== 'JSON') {
              Cached.insertReceivedVoice({'barcode': barcode, 'voice_for': voice_for, 'file_type': file_type})
              voices.set(voice_for, voice_cache_path + voice_for + '/' + barcode + file_type)
            }
            else {
              fs.readFile(voice_cache_path + voice_for + '/' + barcode + file_type, 'utf8', function (err, data) {
                if (err) throw err;
                Cached.insert(JSON.parse(data))
              })
            }
          }
          orderVoicesFiles(voices, allergens, readBarcode.toString('utf8'))
        }) 
      })
      } else if (response.statusCode === 204) {
        player.play(path.join(__dirname, '../audio/status/not_identified.mp3'), (err) => {
          if (err) console.log(`Could not play sound: ${err}`)
          motionDetector()
        })
        return
      }
    })
  }
  else {
    orderVoicesFiles(voices, allergens, readBarcode.toString('utf8'))
  }
}

// Activate sensor when program starts
motionDetector()

function orderVoicesFiles (audio_files, allergens, barcode) {
  let correctOrder = []
  let addedFiles = 0

  if (audio_files.has('name')) {
    correctOrder.push(audio_files.get('name'))
    addedFiles += 1
  }
  if (allergens) {
    const productAllergens = Cached.get_allergens(barcode)
    if (productAllergens) {
      let allergic = new Set()
      let allergens = productAllergens.allergens.split(',')
      for (let i of allergens) {
        let myAllergy = Cached.is_allergic(i.replace(' ', '').toLowerCase())
        if (myAllergy) {
          allergic.add(myAllergy)
        }
      }
      if (allergic.size > 0) {
        correctOrder.push(path.join(__dirname, '../audio/allergies/beware.mp3'))
        addedFiles += 1
        for (let i of allergic) {
          const filePath = '../audio/allergies/' + i + '.mp3'

          correctOrder.push(path.join(__dirname, filePath))
          addedFiles += 1
        }
        correctOrder.push(path.join(__dirname, '../audio/allergies/allergic_reaction.mp3'))
        addedFiles += 1
      }
    }
  }
  if (audio_files.has('description')) {
    correctOrder.push(audio_files.get('description'))
    addedFiles += 1
  }
  if (audio_files.has('weight')) {
    correctOrder.push(audio_files.get('weight'))
    addedFiles += 1
  }
  if (audio_files.has('brand')) {
    correctOrder.push(audio_files.get('brand'))
    addedFiles += 1
  }
  if (audio_files.has('origin')) {
    correctOrder.push(audio_files.get('origin'))
    addedFiles += 1
  }
  if (audio_files.has('category')) {
    correctOrder.push(audio_files.get('category'))
    addedFiles += 1
  }
  if (audio_files.has('subcategory')) {
    correctOrder.push(audio_files.get('subcategory'))
    addedFiles += 1
  }
  if (audio_files.has('ingredients')) {
    correctOrder.push(audio_files.get('ingredients'))
    addedFiles += 1
  }
  if (audio_files.has('nutritions')) {
    correctOrder.push(audio_files.get('nutritions'))
    addedFiles += 1
  }
  if (audio_files.has('preparation')) {
    correctOrder.push(audio_files.get('preparation'))
    addedFiles += 1
  }
  if (audio_files.has('status')) {
    correctOrder.push(audio_files.get('status'))
    addedFiles += 1
  }

  if (addedFiles > 0 && correctOrder.length === addedFiles) {
    const opts = {output: 'response', export: 'mp3,', gap: 0}
    audiosprite(correctOrder, opts, function(err, obj) {
      if (err) return console.error(err)
      player.play(path.join(__dirname, '../response.mp3'), (err) => {
        if (err) console.log(`Could not play sound: ${err}`)
        motionDetector()
      })
    })
  }
}

function exit (err) {
  if (err) console.log('An error occurred: ' + err)
  player.play(path.join(__dirname, '../audio/status/goodbye.mp3'), (err) => {
    if (err) console.log(`Could not play sound: ${err}`)
    pirSensor.unexport()
    console.log('Goodbye')
    process.exit()
  })
}

// Interruption from keyboard
process.on('SIGINT', exit)