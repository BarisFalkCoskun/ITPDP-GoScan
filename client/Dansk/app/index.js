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
    siteTitle: "Go Scans hovedmenu",
    mainHeader: "Go Scans hovedmenu",
    topRightLink: '/scanned',
    topRightText: 'Få produkt information',
    topRightDescription: "Få produktets information fra det senest skannede produkt",
    topLeftLink: '/camera',
    topLeftText: 'Tag billede',
    topLeftDescription: 'Identificere et produkt via GoScans kamera',
    bottomLeftText: 'Hjælp',
    bottomLeftDescription: 'Hjælpemenuen er endnu ikke blevet implementeret',
    bottomRightLink: '/user-settings',
    bottomRightText: 'Indstillinger',
    bottomRightDescription: 'Sæt dine allergier, læsepræferencer eller andre indstillinger'
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
                    siteTitle: Cached.get_name(productBarcode).name +  "s information",
                    topRightLink: '/preparation',
                    topRightText: 'Tilberedning',
                    topRightDescription: "Få tilberedningen for produktet.",
                    topLeftLink: '/ingredients',
                    topLeftText: 'Ingredienser',
                    topLeftDescription: "Få produktets ingredienser",
                    bottomLeftLink: '/nutritional-content',
                    bottomLeftText: 'Næringsindhold',
                    bottomLeftDescription: "Få produktets næringsindhold",
                    bottomRightLink: '/',
                    bottomRightText: 'Gå tilbage',
                    bottomRightDescription: "Gå tilbage til hovedmenuen"
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
        siteTitle: Cached.get_name(productBarcode).name +  "s Information",
        topRightLink: '/preparation',
        topRightText: 'Tilberedning',
        topRightDescription: "Få tilberedningen til produktetet.",
        topLeftLink: '/ingredients',
        topLeftText: 'Ingredienser',
        topLeftDescription: "Få produktets ingredienser",
        bottomLeftLink: '/nutritional-content',
        bottomLeftText: 'Næringsindhold',
        bottomLeftDescription: "Få produktets næringsindhold",
        bottomRightLink: '/',
        bottomRightText: 'Gå tilbage',
        bottomRightDescription: "Gå tilbage til hovedmenuen"
      })
    }
  }
})

app.get('/preparation', (req, res) => {
  const product = Cached.get_preparation(recentScan.toString('utf8'))
  let textToBeRead = null
  const title = 'Tilberedning til ' + product.name
  const name = product.name

  if (!product.preparation) {
    textToBeRead = 'Beklager, ingen tilberedningsinformation for ' + name + ' kunne findes'
  } else {
    textToBeRead = 'Tilberedning til ' + name  + ': ' + product.preparation
  }

  // Preparation
  res.render('info-menu', {
    siteTitle: title,
    topMenuText: textToBeRead,
    bottomLeftText: 'Læs højt',
    bottomLeftDescription: "Læs tilberedningen til produktet højt",
    bottomRightLink: '/scanned',
    bottomRightText: 'Gå tilbage',
    bottomRightDescription: "Gå tilbage til forrige side"
  })
})

// Ingredients
app.get('/ingredients', (req, res) => {
  const product = Cached.get_ingredients(recentScan.toString('utf8'))
  const productAllergens = Cached.get_allergens(recentScan.toString('utf8'))
  const title = product.name + "s " + 'ingredienser'
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
    textToBeRead = 'Beklager, ingen ingrediensinformation kunne findes for ' + product.name
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
    textToBeRead = "Vær opmærksom på at " + product.name + " indeholder " + myAllergens + ", hvilket kan give en allergisk reaktion " + product.name + ' indeholder følgende ingredienser: ' + product.ingredients
  }
  else {
    textToBeRead = product.name + ' indeholder følgende ingredienser: ' + product.ingredients
  }

  // Ingredients
  res.render('info-menu', {
    siteTitle: title,
    topMenuText: textToBeRead,
    bottomLeftText: 'Læs højt',
    bottomLeftDescription: "Læs produktets ingredienser højt",
    bottomRightLink: '/scanned',
    bottomRightText: 'Gå tilbage',
    bottomRightDescription: "Gå tilbage til forrige side"
  })
})

// Nutritional Content
app.get('/nutritional-content', (req, res) => {
  const product = Cached.get_nutritions(recentScan.toString('utf8'))
  const name = Cached.get_name(recentScan.toString('utf8')).name
  let textToBeRead = {}
  const title = name + "s " + 'næringsindhold'
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
    bottomLeftText: 'Læs højt',
    bottomLeftDescription: "Læs produktets næringsindhold højt",
    bottomRightLink: '/scanned',
    bottomRightText: 'Gå tilbage',
    bottomRightDescription: "Gå tilbage til forrige side"
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
            const title =  "Go Scans kamera"
            let textToBeRead = JSON.parse(data).name
            res.render('info-menu', {
              siteTitle: title,
              topMenuText: textToBeRead,
              bottomLeftText: 'Læs højt',
              bottomLeftDescription: "Læs beskrivelsen af objektet højt",
              bottomRightLink: '/',
              bottomRightText: 'Gå tilbage',
              bottomRightDescription: "Gå tilbage til forrige side"
            })
        })
      }
    )))
  })
})

// User Settings
app.get('/user-settings', (req, res) => {
  res.render('menu', {
    siteTitle: 'Indstillinger',
    topRightLink: '/allergies',
    topRightText: 'Mine allergier',
    topRightDescription: 'Indstil dine allergier for at blive advaret, hvis et produkt indeholder allergener, som kan give en allergisk reaktion',
    topLeftLink: '/reading-pref',
    topLeftText: 'Oplæsningspræferencer',
    topLeftDescription: 'Indstil hvad QuickMode skal læse højt, når et produkt er blevet skannet',
    bottomLeftText: 'Andre indstillinger',
    bottomLeftDescription: 'Andre indstillinger er endnu ikke blevet implementeret',
    bottomRightLink: '/',
    bottomRightText: 'Gå tilbage',
    bottomRightDescription: "Gå tilbage til hovedmenuen"
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
            siteTitle: "Mine allergier",
            mainHeader: "Allergier",
            mainDescription: "Vælg dine allergier for at få en advarelse, hvis et produkt indeholder allergener, som kan give dig en allergisk reaktion.",
            sendTo: "allergies-settings",
            groups: groups,
            topRightText: "Gem",
            topRightDescription: "Gem ændringerne",
            bottomRightLink: "/user-settings",
            bottomRightText: "Annuller",
            bottomRightDescription: "Annuller ændringerne"
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
      siteTitle: "Mine allergier",
      mainHeader: "Allergier",
      mainDescription: "Vælg dine allergier for at få en advarelse, hvis et produkt indeholder allergener, som kan give dig en allergisk reaktion.",
      sendTo: "allergies-settings",
      groups: groups,
      topRightText: "Gem",
      topRightDescription: "Gem ændringerne",
      bottomRightLink: "/user-settings",
      bottomRightText: "Annuller",
      bottomRightDescription: "Annuller ændringerne"
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
    siteTitle: 'Oplæsningspræferencer',
    mainHeader: 'Oplæsnings præferencer',
    mainDescription: 'Indstil hvad QuickMode skal læse højt, når et produkt er blevet skannet',
    sendTo: "reading-settings",
    groups: groups,
    topRightText: "Gem",
    topRightDescription: "Gem ændringerne",
    bottomRightLink: '/user-settings',
    bottomRightText: "Annuller",
    bottomRightDescription: "Annuller ændringerne"
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