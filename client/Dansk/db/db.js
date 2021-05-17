const Database = require('better-sqlite3')
const path = require('path')
const dbName = path.join(__dirname, 'cache.db')
const cache = new Database(dbName)

const dbSettings = path.join(__dirname, 'settings.db')
const settings = new Database(dbSettings)

const dbAllergies = path.join(__dirname, 'allergies.db')
const allergies = new Database(dbAllergies)


/***
 * Creating table and indexes
 */

// Creating table and indexes to cache product information
cache
	.prepare('CREATE TABLE IF NOT EXISTS products ( barcode TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT null, package_description TEXT DEFAULT null, brand TEXT DEFAULT null, weight TEXT DEFAULT null, origin TEXT DEFAULT null, labels TEXT DEFAULT null, storage TEXT DEFAULT null, preparation TEXT DEFAULT null, category TEXT DEFAULT null, subcategory TEXT DEFAULT null, ingredients TEXT DEFAULT null, allergens TEXT DEFAULT null, page_id TEXT DEFAULT null, updated TEXT DEFAULT null )')
	.run()
cache
	.prepare('CREATE INDEX IF NOT EXISTS `product_lookup` ON `products` ( `barcode`, `page_id` )')
	.run()
cache
	.prepare('CREATE INDEX IF NOT EXISTS `product_last_updated` ON `products` ( `updated` )')
	.run()
  
// Creating table and indexes to cache nutritions
cache
	.prepare('CREATE TABLE IF NOT EXISTS nutritions ( barcode TEXT PRIMARY KEY, energy TEXT DEFAULT null, fat TEXT DEFAULT null, saturated_fat TEXT DEFAULT null, monounsaturated_fat TEXT DEFAULT null, polyunsaturated_fat TEXT DEFAULT null, vitamin_a TEXT DEFAULT null, vitamin_b1 TEXT DEFAULT null, vitamin_b2 TEXT DEFAULT null, vitamin_b5 TEXT DEFAULT null, vitamin_b6 TEXT DEFAULT null, vitamin_b12 TEXT DEFAULT null, vitamin_c TEXT DEFAULT null, vitamin_d TEXT DEFAULT null, vitamin_d3 TEXT DEFAULT null, vitamin_e TEXT DEFAULT null, vitamin_k TEXT DEFAULT null, vitamin_k3 TEXT DEFAULT null, carbohydrate TEXT DEFAULT null, sugars TEXT DEFAULT null, polyol TEXT DEFAULT null, dietary_fiber TEXT DEFAULT null, protein TEXT DEFAULT null, salt TEXT DEFAULT null, sodium TEXT DEFAULT null, water TEXT DEFAULT null, calcium TEXT DEFAULT null, niacin TEXT DEFAULT null, taurine TEXT DEFAULT null, silicon TEXT DEFAULT null, nitrate TEXT DEFAULT null, magnesium TEXT DEFAULT null, sulfate TEXT DEFAULT null, bicarbonate TEXT DEFAULT null, thiamine TEXT DEFAULT null, nucleotide TEXT DEFAULT null, iodine TEXT DEFAULT null, selenium TEXT DEFAULT null, fluoride TEXT DEFAULT null, copper TEXT DEFAULT null, zinc TEXT DEFAULT null, iron TEXT DEFAULT null, phosphorus TEXT DEFAULT null, chloride TEXT DEFAULT null, potassium TEXT DEFAULT null, l_carnitine TEXT DEFAULT null, inositol TEXT DEFAULT null, choline TEXT DEFAULT null, biotin TEXT DEFAULT null, folate TEXT DEFAULT null, lactose TEXT DEFAULT null, cholesterol TEXT DEFAULT null, trans_fat TEXT DEFAULT null, starch TEXT DEFAULT null, inorganic TEXT DEFAULT null, tree_stuff TEXT DEFAULT null, phosphoric TEXT DEFAULT null, methionine TEXT DEFAULT null, raw_protein TEXT DEFAULT null, raw_fat TEXT DEFAULT null, raw_oil TEXT DEFAULT null, chromium TEXT DEFAULT null, molybdenum TEXT DEFAULT null, field_horsetail TEXT DEFAULT null, ascophyllum TEXT DEFAULT null, dry_yeast TEXT DEFAULT null, omega_3 TEXT DEFAULT null, omega_6 TEXT DEFAULT null, potassium_iodide TEXT DEFAULT null, manganese TEXT DEFAULT null, manganese_sulfate TEXT DEFAULT null, manganese_sulfate_monohydrate TEXT DEFAULT null, manganese_oxide TEXT DEFAULT null, cassia_gum TEXT DEFAULT null, copper_sulfate_pentahydrate TEXT DEFAULT null, iron_sulfate_monohydrate TEXT DEFAULT null, folinic_acid TEXT DEFAULT null, nmes TEXT DEFAULT null, nfe_carbohydrate TEXT DEFAULT null, cobalt_sulfate TEXT DEFAULT null, fish_oil TEXT DEFAULT null, epa TEXT DEFAULT null, dha TEXT DEFAULT null, dha_epa TEXT DEFAULT null, crude_ash TEXT DEFAULT null, inulin TEXT DEFAULT null, beta_glucans TEXT DEFAULT null, misc TEXT DEFAULT null, updated TEXT DEFAULT null, FOREIGN KEY (barcode) REFERENCES products(barcode) )')
	.run()
cache
	.prepare('CREATE INDEX IF NOT EXISTS `nutritions_lookup` ON `nutritions` ( `barcode` )')
	.run()
cache
	.prepare('CREATE INDEX IF NOT EXISTS `nutritions_last_updated` ON `nutritions` ( `updated` )')
	.run()
  
cache
	.prepare('CREATE TABLE IF NOT EXISTS beverages ( barcode PRIMARY KEY, description TEXT DEFAULT null, flavor TEXT DEFAULT null, dryness TEXT DEFAULT null, serving_suggestions TEXT DEFAULT null, country TEXT DEFAULT null, region TEXT DEFAULT null, producer TEXT DEFAULT null, year TEXT DEFAULT null, grape TEXT DEFAULT null, size TEXT DEFAULT null, closure TEXT DEFAULT null, alcohol TEXT DEFAULT null, country_detail TEXT DEFAULT null, region_detail TEXT DEFAULT null, grapes_detail TEXT DEFAULT null, producer_detail TEXT DEFAULT null, reviews TEXT DEFAULT null, updated TEXT DEFAULT null, FOREIGN KEY (barcode) REFERENCES products(barcode) )')
	.run()
cache
	.prepare('CREATE INDEX IF NOT EXISTS `beverages_lookup` ON `beverages` ( `barcode` )')
	.run()
cache
	.prepare('CREATE INDEX IF NOT EXISTS `beverages_last_updated` ON `beverages` ( `updated` )')
	.run()

// Creating table and indexes to cache voice files for product
cache
  .prepare('CREATE TABLE IF NOT EXISTS "voices" ( `barcode` TEXT, `voice_for` TEXT, `file_type` TEXT NOT NULL, PRIMARY KEY(`voice_for`,`barcode`) )')
  .run()
cache
  .prepare('CREATE INDEX IF NOT EXISTS `voices_lookup` ON `voices` ( `barcode`, `voice_for` )')
  .run()

cache
  .prepare('CREATE TABLE IF NOT EXISTS "allergy" ( `allergen` TEXT, `food_group` TEXT NOT NULL, PRIMARY KEY(`allergen`) )')
  .run()
cache
  .prepare('CREATE INDEX IF NOT EXISTS `allergy_lookup` ON `allergy` ( `allergen`, `food_group` )')
  .run()

settings
  .prepare('CREATE TABLE IF NOT EXISTS `allergy` ( `allergen` TEXT, `allergic` INTEGER DEFAULT 0, PRIMARY KEY(`allergen`) )')
  .run()
settings
  .prepare('CREATE INDEX IF NOT EXISTS `allergy_lookup` ON `allergy` ( `allergen` )')
  .run()

settings
  .prepare('CREATE TABLE IF NOT EXISTS `product_info` ( `option` TEXT, `preference` INTEGER DEFAULT 1, PRIMARY KEY(`option`))')
  .run()
settings
  .prepare('CREATE INDEX IF NOT EXISTS `product_info_lookup` ON `product_info` ( `option` )')
  .run()

class Cached {
  // Inserts info that has been cached
  static insert (cacheInfo) {
    cache
      .prepare('INSERT or REPLACE INTO products( barcode, name, description, package_description, brand, weight, origin, labels, storage, preparation, category, subcategory, ingredients, allergens, page_id, updated ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(cacheInfo.barcode, cacheInfo['name'], cacheInfo.description, cacheInfo.package_description, cacheInfo.brand, cacheInfo.weight, cacheInfo.origin, cacheInfo.labels, cacheInfo.storage, cacheInfo.preparation, cacheInfo.category, cacheInfo.subcategory, cacheInfo.ingredients, cacheInfo.allergens, cacheInfo.page_id, cacheInfo.updated)
    cache
      .prepare('INSERT or REPLACE INTO nutritions( barcode, energy, fat, saturated_fat, monounsaturated_fat, polyunsaturated_fat, vitamin_a, vitamin_b1, vitamin_b2, vitamin_b5, vitamin_b6, vitamin_b12, vitamin_c, vitamin_d, vitamin_d3, vitamin_e, vitamin_k, vitamin_k3, carbohydrate, sugars, polyol, dietary_fiber, protein, salt, sodium, water, calcium, niacin, taurine, silicon, nitrate, magnesium, sulfate, bicarbonate, thiamine, nucleotide, iodine, selenium, fluoride, copper, zinc, iron, phosphorus, chloride, potassium, l_carnitine, inositol, choline, biotin, folate, lactose, cholesterol, trans_fat, starch, inorganic, tree_stuff, phosphoric, methionine, raw_protein, raw_fat, raw_oil, chromium, molybdenum, field_horsetail, ascophyllum, dry_yeast, omega_3, omega_6, potassium_iodide, manganese, manganese_sulfate, manganese_sulfate_monohydrate, manganese_oxide, cassia_gum, copper_sulfate_pentahydrate, iron_sulfate_monohydrate, folinic_acid, nmes, nfe_carbohydrate, cobalt_sulfate, fish_oil, epa, dha, dha_epa, crude_ash, inulin, beta_glucans, misc ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(cacheInfo.barcode, cacheInfo.energy, cacheInfo.fat, cacheInfo.saturated_fat, cacheInfo.monounsaturated_fat, cacheInfo.polyunsaturated_fat, cacheInfo.vitamin_a, cacheInfo.vitamin_b1, cacheInfo.vitamin_b2, cacheInfo.vitamin_b5, cacheInfo.vitamin_b6, cacheInfo.vitamin_b12, cacheInfo.vitamin_c, cacheInfo.vitamin_d, cacheInfo.vitamin_d3, cacheInfo.vitamin_e, cacheInfo.vitamin_k, cacheInfo.vitamin_k3, cacheInfo.carbohydrate, cacheInfo.sugars, cacheInfo.polyol, cacheInfo.dietary_fiber, cacheInfo.protein, cacheInfo.salt, cacheInfo.sodium, cacheInfo.water, cacheInfo.calcium, cacheInfo.niacin, cacheInfo.taurine, cacheInfo.silicon, cacheInfo.nitrate, cacheInfo.magnesium, cacheInfo.sulfate, cacheInfo.bicarbonate, cacheInfo.thiamine, cacheInfo.nucleotide, cacheInfo.iodine, cacheInfo.selenium, cacheInfo.fluoride, cacheInfo.copper, cacheInfo.zinc, cacheInfo.iron, cacheInfo.phosphorus, cacheInfo.chloride, cacheInfo.potassium, cacheInfo.l_carnitine, cacheInfo.inositol, cacheInfo.choline, cacheInfo.biotin, cacheInfo.folate, cacheInfo.lactose, cacheInfo.cholesterol, cacheInfo.trans_fat, cacheInfo.starch, cacheInfo.inorganic, cacheInfo.tree_stuff, cacheInfo.phosphoric, cacheInfo.methionine, cacheInfo.raw_protein, cacheInfo.raw_fat, cacheInfo.raw_oil, cacheInfo.chromium, cacheInfo.molybdenum, cacheInfo.field_horsetail, cacheInfo.ascophyllum, cacheInfo.dry_yeast, cacheInfo.omega_3, cacheInfo.omega_6, cacheInfo.potassium_iodide, cacheInfo.manganese, cacheInfo.manganese_sulfate, cacheInfo.manganese_sulfate_monohydrate, cacheInfo.manganese_oxide, cacheInfo.cassia_gum, cacheInfo.copper_sulfate_pentahydrate, cacheInfo.iron_sulfate_monohydrate, cacheInfo.folinic_acid, cacheInfo.nmes, cacheInfo.nfe_carbohydrate, cacheInfo.cobalt_sulfate, cacheInfo.fish_oil, cacheInfo.epa, cacheInfo.dha, cacheInfo.dha_epa, cacheInfo.crude_ash, cacheInfo.inulin, cacheInfo.beta_glucans, cacheInfo.updated)
  }
  // Inserts file that has been cached
  static insertReceivedVoice (product) {
    cache.prepare('INSERT or REPLACE INTO voices(barcode, voice_for, file_type) VALUES (?, ?, ?)').run(product.barcode, product.voice_for, product.file_type)
  }

  // Gets all information from specified barcode
  static all (barcode) {
    return cache.prepare('SELECT * FROM products AS p LEFT OUTER JOIN nutritions AS n ON p.barcode = n.barcode WHERE p.barcode = ?').get(barcode)
  }

  static get_name (barcode) {
    return cache.prepare('SELECT name FROM products WHERE barcode = ?').get(barcode)
  }

  static get_ingredients (barcode) {
    return cache.prepare('SELECT name, ingredients FROM products WHERE barcode = ?').get(barcode)
  }

  static get_allergens (barcode) {
    return cache.prepare('SELECT allergens FROM products WHERE barcode = ? AND allergens IS NOT NULL').get(barcode)
  }

  static get_preparation (barcode) {
    return cache.prepare('SELECT name, preparation FROM products WHERE barcode = ?').get(barcode)
  }

  static get_nutritions (barcode) {
    return cache.prepare('SELECT n.energy, n.fat, n.saturated_fat, n.monounsaturated_fat, n.polyunsaturated_fat, n.vitamin_a, n.vitamin_b1, n.vitamin_b2, n.vitamin_b5, n.vitamin_b6, n.vitamin_b12, n.vitamin_c, n.vitamin_d, n.vitamin_d3, n.vitamin_e, n.vitamin_k, n.vitamin_k3, n.carbohydrate, n.sugars, n.polyol, n.dietary_fiber, n.protein, n.salt, n.sodium, n.water, n.calcium, n.niacin, n.taurine, n.silicon, n.nitrate, n.magnesium, n.sulfate, n.bicarbonate, n.thiamine, n.nucleotide, n.iodine, n.selenium, n.fluoride, n.copper, n.zinc, n.iron, n.phosphorus, n.chloride, n.potassium, n.l_carnitine, n.inositol, n.choline, n.biotin, n.folate, n.lactose, n.cholesterol, n.trans_fat, n.starch, n.inorganic, n.tree_stuff, n.phosphoric, n.methionine, n.raw_protein, n.raw_fat, n.raw_oil, n.chromium, n.molybdenum, n.field_horsetail, n.ascophyllum, n.dry_yeast, n.omega_3, n.omega_6, n.potassium_iodide, n.manganese, n.manganese_sulfate, n.manganese_sulfate_monohydrate, n.manganese_oxide, n.cassia_gum, n.copper_sulfate_pentahydrate, n.iron_sulfate_monohydrate, n.folinic_acid, n.nmes, n.nfe_carbohydrate, n.cobalt_sulfate, n.fish_oil, n.epa, n.dha, n.dha_epa, n.crude_ash, n.inulin, n.beta_glucans FROM products AS p INNER JOIN nutritions AS n ON n.barcode = p.barcode WHERE p.barcode = ?').get(barcode)
  }

  static get_general_info (barcode) {
    return cache.prepare('SELECT name, weight, brand, origin, description, allergens, category, subcategory FROM products WHERE barcode = ?').get(barcode)
  }

  // Check if file has been cached
  static cachedVoices (voice) {
    return cache.prepare('SELECT barcode, voice_for, file_type FROM voices WHERE barcode = ? AND voice_for = ?').get(voice.barcode, voice.voice_for)
  }

  static cacheAllergies (allergies) {
    for (let a of allergies) {
      cache
        .prepare('INSERT or REPLACE INTO allergy(allergen, food_group) VALUES (?, ?)')
        .run(a.allergen, a.food_group)
    }
  }
  static insertAllergy (allergy) {
    cache.prepare('INSERT or REPLACE INTO allergy(allergen, food_group) VALUES (?, ?)').run(allergy.allergen, allergy.food_group)
  }

  static is_allergic (ingredient) {
    let productAllergies = cache.prepare('SELECT * FROM allergy WHERE allergen = ?').all(ingredient)
    let myAllergies = Settings.myAllergies()
    let myAllergiesList = []
    for (let a of myAllergies) {
      myAllergiesList.push(a.allergen)
    }

    for (let a of productAllergies) {
      if (myAllergiesList.includes(a.food_group)) {
        return a.food_group
      }
    }
    return
  }
}

class Settings {
  static insertAllergies (allergies) {
    settings
      .prepare('INSERT or REPLACE INTO allergy(allergen, allergic) VALUES (?, ?)')
      .run(allergies.allergen, allergies.allergic)
  }

  static insertReadingPref (pref) {
    settings
      .prepare('INSERT or REPLACE INTO product_info(option, preference) VALUES (?, ?)')
      .run(pref.option, pref.preference)
  }

  static allAllergies () {
    return settings.prepare('SELECT * from allergy').all()
  }

  static myAllergies () {
    const myAllergies = settings.prepare('SELECT * from allergy WHERE allergic = 1').all()
    return myAllergies
  }

  static allOptions () {
    return settings.prepare('SELECT * from product_info').all()
  }

  static enabledOptions () {
    return settings.prepare('SELECT * from product_info WHERE preference = 1').all()
  }

  static insertGroups (code) {
    for (let a in code) {
      settings
        .prepare('INSERT or IGNORE INTO allergy(allergen) VALUES (?)')
        .run(code[a].food_group)
    }
  }
}

module.exports = cache
module.exports = settings
module.exports.Cached = Cached
module.exports.Settings = Settings