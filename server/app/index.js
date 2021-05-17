const path = require('path')
const bodyParser = require('body-parser')
const fs = require('fs')

// Router
const express = require('express')
const app = express()
const router = express.Router()
const compression = require('compression')

// Databases
const Cache = require('../db/db').Cache
const ProductInfo = require('../db/db').ProductInfo
const Allergy = require('../db/db').Allergy

const archiver = require('archiver')
let output = null
let archive = null

// Imports the Google Cloud client library
const textToSpeech = require('@google-cloud/text-to-speech')

// Creates a client
const textClient = new textToSpeech.TextToSpeechClient({
  keyFilename: '/path/GoScan.json'
})
const cloudsight = require('cloudsight')({
  apikey: 'api-key'
})

const port = 3000

app.use('/goscan', router)

router.use(compression())

// Receive POST
router.use(bodyParser.urlencoded({ extended: true }))

// Receive JSON
router.use(bodyParser.json({limit: '10mb'}))

// Receive JPEG
router.use(bodyParser.raw({ type: 'image/jpeg', limit: '10mb' }))

// Quick mode activated by sensor
router.post('/quickmode', (req, res) => {
  // Check barcode in database
  const productInfo = ProductInfo.get_product_info(req.body)

  // No product information not found
  if (!productInfo) {
    res.status(204).end()
    return
  } else {
    const barcode = productInfo['barcode']
    
    let fileExtension = '.mp3'
    let archiveExtension = '.tar'
    // create a file to stream archive data to
    output = fs.createWriteStream(path.join(__dirname, '../cache/archive/voiceFiles' + archiveExtension))

    const options = {
      headers: {
        'x-timestamp': Date.now(),
        'x-sent': true,
        'file-type': fileExtension
      }
    }

    let voices = []
    let current_iter = 0

    req.body.voice_for.forEach((voice, index, array) => {
      const productNamePath = path.join(__dirname, '../cache/voice/') + voice + '/' + req.body.barcode + fileExtension
      // See if voice file has already been cached
      if (!Cache.cachedVoices({ 'barcode': req.body.barcode, 'voice_for': voice })) {
        // Text to be read
        let text = productInfo[voice]
        if (text === null || text === undefined) {
          text = 'Unavailable'
        }
      
        const speechRequest = {
          // Type of audio encoding
          audioConfig: {
            'audioEncoding': 'MP3',
            'pitch': '0.00',
            'speakingRate': '1.00'
          },
          input: {text: voice + '. ' + text},
          'voice': {
            'languageCode': 'en-US',
            'name': 'en-US-Wavenet-F'
          }
        }

        // Performs the Text-to-Speech request
        textClient.synthesizeSpeech(speechRequest, (err, response) => {
          if (err) {
            console.error('ERROR:', err)
            return
          }

          // Write the binary audio content to a local file
          fs.writeFile(productNamePath, response.audioContent, 'binary', err => {
            if (err) {
              console.error('ERROR:', err)
              return
            }
            
            // File is cached, update the database
            Cache.insertReceivedVoice({ 'barcode': barcode, 'voice_for': voice, 'file_type': fileExtension })
            const file_name = {
              'name': barcode + fileExtension,
              'extension': fileExtension,
              'folder': voice,
              'path': path.join(__dirname, '../cache/voice/') + voice + '/' + barcode + fileExtension
            }
            
            voices.push(file_name)
            current_iter += 1
            makeArchivedFile(current_iter, array, voices, productInfo)
            console.log('Audio content written to file: ' + barcode + fileExtension)
          })
        })
      }
      else {
        const file_name = {
          'name': barcode + fileExtension,
          'extension': fileExtension,
          'folder': voice,
          'path': productNamePath
        }
        voices.push(file_name)
        current_iter += 1
        makeArchivedFile(current_iter, array, voices, productInfo)
      }
    })

    output.on('close', function() {
      output = null
      res.status(200).sendFile(path.join(__dirname, '../cache/archive/') + 'voiceFiles' + archiveExtension, options)
    })
  }
})

function makeArchivedFile (index, array, voices, productInfo) {
  if (index === array.length) {
    archive = archiver('tar', {
      zlib: { level: 9 } // Sets the compression level.
    })

    const jsonPath = path.join(__dirname, '../cache/JSON/') + productInfo['barcode'] + '.json'
    fs.writeFile(jsonPath, JSON.stringify(productInfo), 'utf8', err => {
      for (let voice of voices) {
        // append a file
        archive.file(voice.path, { name: '/' + voice.folder + '/' + voice.name })
      }
      archive.file(jsonPath, { name: '/' + 'JSON' + '/' + productInfo['barcode'] + '.json' })
      archive.pipe(output)
      // pipe archive data to the file
      archive.finalize()
      return true
    })
  }
  return false
}

router.get('/allergy', (req, res) => {
  // Get product info from db
  const groups = Allergy.foodGroups()
  res.status(200).json(groups)
})

router.post('/get-allergies', (req, res) => {
  // Get product info from db
  res.status(200).json(Allergy.get_foodGroups(req.body))
})

// Request from online application
router.post('/barcode', (req, res) => {
  // Get product info from db
  const productInfo = ProductInfo.get_product_info(req.body)
  // No info
  if (!productInfo) {
    res.status(204).end()
  } else {
    const fileExtension = '.json'
    const options = {
      headers: {
        'x-timestamp': Date.now(),
        'x-sent': true,
        'file-type': fileExtension
      }
    }
    const archiveExtension = '.tar'
    const productNamePath = path.join(__dirname, '../cache/voice/') + 'JSON' + '/' + req.body.barcode + fileExtension
    // create a file to stream archive data to
    const productOutput = fs.createWriteStream(path.join(__dirname, '../cache/archive/file' + archiveExtension))
    const productArchive = archiver('tar', {
      zlib: { level: 9 } // Sets the compression level.
    })

    const jsonPath = path.join(__dirname, '../cache/JSON/') + productInfo['barcode'] + fileExtension
    fs.writeFile(jsonPath, JSON.stringify(productInfo), 'utf8', err => {
      productArchive.file(jsonPath, { name: '/' + 'JSON' + '/' + productInfo['barcode'] + fileExtension })
      productArchive.pipe(productOutput)
      // pipe archive data to the file
      productArchive.finalize()
      return true
    })

    productOutput.on('close', function() {
      res.status(200).sendFile(path.join(__dirname, '../cache/archive/') + 'file' + archiveExtension, options)
    })
  }
})

// Request from online application
router.post('/camera', (req, res, next) => {
  // Store image received on disk
  fs.writeFile(path.join(__dirname, '../img/goscan.jpg'), req.body, (err) => {
    if (err) throw err
    // Request to API
    const image = {
      image: path.join(__dirname, '../img/goscan.jpg'),
      locale: 'en'
    }
    cloudsight.request(image, true, (err, data) => {
      if (err) console.log(err)
      // Return describing of image
      res.status(200).json(data)
    })
  })
})

// Error message
app.use((err, request, response, next) => {
  console.log(err)
  response.status(500).send('Something broke!')
})

// Debugging purposes
app.listen(port, (err) => {
  if (err) return console.error(`An error occurred: ${err}`)
  console.log(`Listening on http://www.coskun.ch/`)
})

function exit (err) {
  if (err) console.log('An error occurred: ' + err)
  process.exit()
}

// Interruption from keyboard
process.on('SIGINT', exit)