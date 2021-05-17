const path = require('path')
const bodyParser = require('body-parser')
const request = require('request')
const player = require('play-sound')(opts = {})

// Used to take picture
const NodeWebcam = require('node-webcam')

// // Driver for barcode scanner
const barcode = require('usb-barcode-transform')

// Server
const express = require('express')
const app = express()
const exphbs = require('express-handlebars')

const archiver = require('archiver')
const decompress = require('decompress')
const compression = require('compression')

const fs = require('fs')
const Cached = require('../db/db').Cached
const Settings = require('../db/db').Settings

const port = 40916

const GoScanClient = 'http://www.coskun.dk:' + port + '/'
const GoScanServer = 'http://www.coskun.ch/'

// Most recent scan
let recentScan = null

// Default options
var opts = {

  // Picture related
  width: 1280,
  height: 720,
  quality: 100,

  rotation: 270,
  skip: 20,

  // Delay to take shot
  delay: 0,

  // Save shots in memory
  saveShots: true,

  // [jpeg, png] support varies
  // Webcam.OutputTypes
  output: 'jpeg',

  // Which camera to use
  // Use Webcam.list() for results
  // false for default device
  device: false,

  // [location, buffer, base64]
  // Webcam.CallbackReturnTypes
  callbackReturn: 'location',

  // Logging
  verbose: false
}

// Barcode stream
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
    recentScan = data
  })

// Initializes handlebars engine and sets the layouts directory
app.engine('.hbs', exphbs({
  defaultLayout: 'main',
  extname: '.hbs',
  layoutsDir: path.join(__dirname, '../views/layouts')
}))
app.set('view engine', '.hbs')
app.set('views', path.join(__dirname, '../views'))
app.set('view cache', false)

// Makes it possible to receive POST
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}))

// Makes it possible to receive JSON
app.use(bodyParser.json({limit: '10mb'}))

// Static resources
app.use(express.static(path.join(__dirname, '../public')))

app.use(compression())

// Frontpage
app.get('/', (req, res) => {
  res.render('menu', {
    siteTitle: "Go Scan's Main Menu",
    mainHeader: "Go Scan's Main Menu",
    topRightLink: '/scanned',
    topRightText: 'Get Product Information',
    topRightDescription: "Get product information from the most recent scanned product",
    topLeftLink: '/camera',
    topLeftText: 'Take Picture',
    topLeftDescription: "Identify an object using Go Scan's camera",
    bottomLeftText: 'Help',
    bottomLeftDescription: 'Help menu. Not yet implemented',
    bottomRightLink: '/user-settings',
    bottomRightText: 'Settings',
    bottomRightDescription: 'Settings menu. Set your allergies, reading preferences or other settings under this menu'
  })
})

// Scanned products
app.get('/scanned', (req, res) => {
  if (recentScan === null) {
    player.play(path.join(__dirname, '../audio/errors/scan_product.mp3'), (err) => {
      if (err) console.log(`Could not play sound: ${err}`)
      res.redirect('/')
    })
  }
  else {
    // Convert barcode to string
    const productBarcode = recentScan.toString('utf8')
    // Check barcode in db
    const productInfo = Cached.all(productBarcode)
    // Barcode not in local db
    if (!productInfo) {
      // Request product info
      const options = {
        uri: GoScanServer + 'goscan/barcode/',
        method: 'POST',
        encoding: null,
        json: {
          'barcode': productBarcode,
        }
      }
      
      request(options, (error, response, body) => {
        const cache_path = path.join(__dirname, '../cache/voice/')
        const archive_path = cache_path
        const file_path = archive_path + 'file.tar'
        
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
                fs.readFile(cache_path + voice_for + '/' + barcode + file_type, 'utf8', function (err, data) {
                  if (err) throw err;
                  Cached.insert(JSON.parse(data))
                  res.render('menu', {
                    siteTitle: Cached.get_name(productBarcode).name +  "'s Information",
                    topRightLink: '/preparation',
                    topRightText: 'Preparation',
                    topRightDescription: "Get preparation for the product.",
                    topLeftLink: '/ingredients',
                    topLeftText: 'Ingredients',
                    topLeftDescription: "Get the product's ingredients.",
                    bottomLeftLink: '/nutritional-content',
                    bottomLeftText: 'Nutritional Content',
                    bottomLeftDescription: "Get the product's nutritional content",
                    bottomRightLink: '/',
                    bottomRightText: 'Go Back',
                    bottomRightDescription: "Go back to the start menu"
                  })
                })
              }
            })
          })
      } else if (response.statusCode === 204) {
        player.play(path.join(__dirname, '../audio/status/not_identified.mp3'), (err) => {
          if (err) console.log(`Could not play sound: ${err}`)
          res.redirect('/')
        })
      }
    })
    } else if (productInfo) {
      res.render('menu', {
        siteTitle: Cached.get_name(productBarcode).name +  "'s Information",
        topRightLink: '/preparation',
        topRightText: 'Preparation',
        topRightDescription: "Get preparation for the product.",
        topLeftLink: '/ingredients',
        topLeftText: 'Ingredients',
        topLeftDescription: "Get the product's ingredients.",
        bottomLeftLink: '/nutritional-content',
        bottomLeftText: 'Nutritional Content',
        bottomLeftDescription: "Get the product's nutritional content",
        bottomRightLink: '/',
        bottomRightText: 'Go Back',
        bottomRightDescription: "Go back to the start menu"
      })
    }
  }
})

app.get('/preparation', (req, res) => {
  const product = Cached.get_preparation(recentScan.toString('utf8'))
  let textToBeRead = null
  const title = 'Preparation for ' + product.name
  const name = product.name

  if (!product.preparation) {
    textToBeRead = 'Sorry, no preparation for ' + name + ' was found'
  } else {
    textToBeRead = 'Preparation for ' + name  + ': ' + product.preparation
  }

  // Preparation
  res.render('info-menu', {
    siteTitle: title,
    topMenuText: textToBeRead,
    bottomLeftText: 'Read aloud',
    bottomLeftDescription: "Tap to read the preparation for the product aloud",
    bottomRightLink: '/scanned',
    bottomRightText: 'Go Back',
    bottomRightDescription: "Go back to the previous page"
  })
})

// Ingredients
app.get('/ingredients', (req, res) => {
  const product = Cached.get_ingredients(recentScan.toString('utf8'))
  const productAllergens = Cached.get_allergens(recentScan.toString('utf8'))
  const title = product.name + "'s " + 'Ingredients'
  let textToBeRead = null
  let allergic = new Set()
  if (productAllergens) {
    let allergens = productAllergens.allergens.split(',')
    for (let i of allergens) {
      let myAllergy = Cached.is_allergic(i.replace(' ', '').toLowerCase())
      if (myAllergy) {
        allergic.add(myAllergy)
      }
    }
  }

  if (!product.ingredients) {
    textToBeRead = 'Sorry, no ingredients were found for ' + product.name
  } else if (allergic.size > 0) {
    let myAllergens = ""
    let index = 0
    for (let i of allergic) {
      index++
      myAllergens += i
      if (index != allergic.size) {
        myAllergens += ', '
      }
    }
    textToBeRead = "Beware " + product.name + " contains " + myAllergens + " which may give you an allergic reaction. " + product.name + ' contains the following ingredients: ' + product.ingredients
  }
  else {
    textToBeRead = product.name + ' contains the following ingredients: ' + product.ingredients
  }

  // Ingredients
  res.render('info-menu', {
    siteTitle: title,
    topMenuText: textToBeRead,
    bottomLeftText: 'Read aloud',
    bottomLeftDescription: "Tap to read the product's ingredients aloud",
    bottomRightLink: '/scanned',
    bottomRightText: 'Go Back',
    bottomRightDescription: "Go back to the previous page"
  })
})

// Nutritional Content
app.get('/nutritional-content', (req, res) => {
  const product = Cached.get_nutritions(recentScan.toString('utf8'))
  const name = Cached.get_name(recentScan.toString('utf8')).name
  let textToBeRead = {}
  const title = name + "'s " + 'Nutrition Facts'
  let notEmpty = false
  for (let p of Object.values(product)) {
    if (p != null) {
      notEmpty = true
      break
    }
  }
  if (notEmpty) {
    for (let i in product) {
      let newIndex = i
      if (i.includes('_')) {
        newIndex = newIndex.replace('_', ' ')
      }
      if (product[i] !== null && i !== 'barcode' && i !== 'name') {
        textToBeRead[newIndex] = product[i]
  
      }
    }
  }
  else {
    textToBeRead = []
  } 
  res.render('nutritional-content', {
    siteTitle: title,
    name: name,
    topMenuText: textToBeRead,
    bottomLeftText: 'Read aloud',
    bottomLeftDescription: "Tap to read the product's nutrition facts aloud",
    bottomRightLink: '/scanned',
    bottomRightText: 'Go Back',
    bottomRightDescription: "Go back to the previous page"
  })
})

app.get('/camera', function (req, res) {
  // Takes an image
  NodeWebcam.capture(path.join(__dirname, '../img/goscan.jpg'), opts, function (err, data) {
    if (err) console.log(err)
    const archive = archiver('tar', {
      zlib: { level: 9 }
    })
    // Stream image to server
    fs.createReadStream(data).pipe(archive.pipe(request.post(GoScanServer + 'goscan/camera/').on('response', function (response) {
      response
        // Data received
        .on('data', (data) => {
            const title =  "Go Scan's Camera"
            let textToBeRead = JSON.parse(data).name
            res.render('info-menu', {
              siteTitle: title,
              topMenuText: textToBeRead,
              bottomLeftText: 'Read aloud',
              bottomLeftDescription: "Tap to read the identified object's description aloud",
              bottomRightLink: '/',
              bottomRightText: 'Go Back',
              bottomRightDescription: "Go back to the previous page"
            })
        })
      }
    )))
  })
})

// User Settings
app.get('/user-settings', (req, res) => {
  res.render('menu', {
    siteTitle: 'Settings',
    topRightLink: '/allergies',
    topRightText: 'My allergies',
    topRightDescription: 'Set your allergies under this menu in order to receive warnings when products contain allergens that you may be allergic to',
    topLeftLink: '/reading-pref',
    topLeftText: 'Reading Preferences',
    topLeftDescription: 'Set what QuickMode should read aloud when a product has been scanned',
    bottomLeftText: 'Other Settings',
    bottomLeftDescription: 'Other settings menu. Not yet implemented',
    bottomRightLink: '/',
    bottomRightText: 'Go Back',
    bottomRightDescription: "Go back to the start menu"
  })
})

// My allergies
app.get('/allergies', (req, res) => {
  let allergies = Settings.allAllergies()

  if (Object.keys(allergies).length === 0) {
    request
      .get(GoScanServer + 'goscan/allergy/')
      .on('response', function (response) {
      // Data received
        response.on('data', function (data) {
          Settings.insertGroups(JSON.parse(data))
          allergies = Settings.allAllergies()

          let groups = []
          for (let i of allergies) {
            const group = {
              name: i.allergen,
              checked: i.allergic
            }
            groups.push(group)
          }

          res.render('settings', {
            siteTitle: "My allergies",
            mainHeader: "Allergies",
            mainDescription: "Select your allergies to get a warning if a product contains allergens that you may be allergic to",
            sendTo: "allergies-settings",
            groups: groups,
            topRightText: "Save",
            topRightDescription: "Save the changes",
            bottomRightLink: "/user-settings",
            bottomRightText: "Cancel",
            bottomRightDescription: "Cancel the changes"
          })
        })
      })
  }
  else if (Object.keys(allergies).length > 0) {

    let groups = []
    for (let i of allergies) {
      const group = {
        name: i.allergen,
        checked: i.allergic
      }

      groups.push(group)
    }

    res.render('settings', {
      siteTitle: "My allergies",
      mainHeader: "Allergies",
      mainDescription: "Select your allergies to get a warning if a product contains allergens that you may be allergic to",
      sendTo: "allergies-settings",
      groups: groups,
      topRightText: "Save",
      topRightDescription: "Save the changes",
      bottomRightLink: "/user-settings",
      bottomRightText: "Cancel",
      bottomRightDescription: "Cancel the changes"
    })
  }
})

app.post('/allergies-settings', (req, res) => {
  for (let allergen in req.body) {
    if (req.body[allergen] === 'false') {
      const user_allergies = {allergen, allergic: 0}
      Settings.insertAllergies(user_allergies)
    }
    else {
    request
      .post(GoScanServer + 'goscan/get-allergies').form({'allergen': allergen})
      .on('response', function (response) {
        let data = ''
        // Successfull
        if (response.statusCode === 200) {
          response.on('data', function (chunk) {
            data += chunk
            const user_allergies = {allergen, allergic: 1}
            Settings.insertAllergies(user_allergies)
          })
          response.on('end', function() {
            const jsonData = JSON.parse(data)
            for (let d of jsonData) {
              Cached.insertAllergy(d)
            }
          })
        }
      })
    }
  }
  res.redirect('/')
})

// Reading preferences
app.get('/reading-pref', (req, res) => {
  const pref = Settings.allOptions()

  if (Object.keys(pref).length === 0) {
    const defaultSettings = ['name', 'description', 'brand', 'preparation', 'weight', 'origin', 'category', 'subcategory', 'allergens', 'ingredients', 'nutritions']
    for (let option of defaultSettings) {
      const user_settings = {option, 'preference' : 1}
      Settings.insertReadingPref(user_settings)
    }
  }

  let options = Settings.allOptions()

  let groups = []
  for (let i of options) {
    const group = {
      name: i.option,
      checked: i.preference
    }

    groups.push(group)
  }

  res.render('settings', {
    siteTitle: 'Reading Preferences',
    mainHeader: 'Reading Preferences',
    mainDescription: "Set what QuickMode should read aloud when a product has been scanned",
    sendTo: "reading-settings",
    groups: groups,
    topRightText: "Save",
    topRightDescription: "Save the changes",
    bottomRightLink: '/user-settings',
    bottomRightText: "Cancel",
    bottomRightDescription: "Cancel the changes"
  })
})

// Reading preferences
app.post('/reading-settings', (req, res) => {
  for (let option in req.body) {
    if (req.body[option] === 'false') {
      const user_settings = {option, preference: 0}
      Settings.insertReadingPref(user_settings)
    }
    else {
      const user_settings = {option, preference: 1}
      Settings.insertReadingPref(user_settings)
    }
  }
  res.redirect('/')
})

// Error message
app.use((err, req, res, next) => {
  console.log(err)
  res.sendStatus(400)
})

// Debugging purposes
app.listen(port, (err) => {
  if (err) return console.error(`An error occurred: ${err}`)
  console.log(`Listening on ${GoScanClient}`)
})