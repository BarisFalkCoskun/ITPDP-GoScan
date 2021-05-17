const Database = require('better-sqlite3')
const path = require('path')
const dbName = path.join(__dirname, 'products.db')
const products = new Database(dbName)

const dbCache = path.join(__dirname, 'cache.db')
const cache = new Database(dbCache)

const dbAllergies = path.join(__dirname, 'allergies.db')
const allergies = new Database(dbAllergies)

/*********
 * Don't create tables for product infomation, since this program doesn't collect product information.
 * Instead it needs a table containing already collected information.
 * Use bilka.py to scrape Bilka's webshop for information (takes at least several hours).
 * Use coop.py to scrape Coop's webshop for information (takes about an hour)
 ********/

products
	.prepare('CREATE TABLE IF NOT EXISTS product_urls ( page_id TEXT PRIMARY KEY, barcode TEXT DEFAULT null, name TEXT DEFAULT null, category TEXT DEFAULT null, subcategory TEXT DEFAULT null, shop TEXT NOT null, updated TEXT DEFAULT null )')
	.run()
products
	.prepare('CREATE INDEX IF NOT EXISTS `product_urls_lookup` ON `product_urls` ( `page_id`, `barcode`, `shop` )')
	.run()
products
	.prepare('CREATE INDEX IF NOT EXISTS `product_urls_last_updated` ON `product_urls` ( `updated` )')
	.run()

products
	.prepare('CREATE TABLE IF NOT EXISTS products ( barcode TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT null, package_description TEXT DEFAULT null, brand TEXT DEFAULT null, weight TEXT DEFAULT null, origin TEXT DEFAULT null, labels TEXT DEFAULT null, storage TEXT DEFAULT null, preparation TEXT DEFAULT null, category TEXT DEFAULT null, subcategory TEXT DEFAULT null, ingredients TEXT DEFAULT null, allergens TEXT DEFAULT null, page_id TEXT DEFAULT null, updated TEXT DEFAULT null, FOREIGN KEY (page_id) REFERENCES products_urls(page_id) )')
	.run()
products
	.prepare('CREATE INDEX IF NOT EXISTS `product_lookup` ON `products` ( `barcode`, `page_id` )')
	.run()
products
	.prepare('CREATE INDEX IF NOT EXISTS `product_last_updated` ON `products` ( `updated` )')
	.run()

products
	.prepare('CREATE TABLE IF NOT EXISTS nutritions ( barcode TEXT PRIMARY KEY, energy TEXT DEFAULT null, fat TEXT DEFAULT null, saturated_fat TEXT DEFAULT null, monounsaturated_fat TEXT DEFAULT null, polyunsaturated_fat TEXT DEFAULT null, vitamin_a TEXT DEFAULT null, vitamin_b1 TEXT DEFAULT null, vitamin_b2 TEXT DEFAULT null, vitamin_b5 TEXT DEFAULT null, vitamin_b6 TEXT DEFAULT null, vitamin_b12 TEXT DEFAULT null, vitamin_c TEXT DEFAULT null, vitamin_d TEXT DEFAULT null, vitamin_d3 TEXT DEFAULT null, vitamin_e TEXT DEFAULT null, vitamin_k TEXT DEFAULT null, vitamin_k3 TEXT DEFAULT null, carbohydrate TEXT DEFAULT null, sugars TEXT DEFAULT null, polyol TEXT DEFAULT null, dietary_fiber TEXT DEFAULT null, protein TEXT DEFAULT null, salt TEXT DEFAULT null, sodium TEXT DEFAULT null, water TEXT DEFAULT null, calcium TEXT DEFAULT null, niacin TEXT DEFAULT null, taurine TEXT DEFAULT null, silicon TEXT DEFAULT null, nitrate TEXT DEFAULT null, magnesium TEXT DEFAULT null, sulfate TEXT DEFAULT null, bicarbonate TEXT DEFAULT null, thiamine TEXT DEFAULT null, nucleotide TEXT DEFAULT null, iodine TEXT DEFAULT null, selenium TEXT DEFAULT null, fluoride TEXT DEFAULT null, copper TEXT DEFAULT null, zinc TEXT DEFAULT null, iron TEXT DEFAULT null, phosphorus TEXT DEFAULT null, chloride TEXT DEFAULT null, potassium TEXT DEFAULT null, l_carnitine TEXT DEFAULT null, inositol TEXT DEFAULT null, choline TEXT DEFAULT null, biotin TEXT DEFAULT null, folate TEXT DEFAULT null, lactose TEXT DEFAULT null, cholesterol TEXT DEFAULT null, trans_fat TEXT DEFAULT null, starch TEXT DEFAULT null, inorganic TEXT DEFAULT null, tree_stuff TEXT DEFAULT null, phosphoric TEXT DEFAULT null, methionine TEXT DEFAULT null, raw_protein TEXT DEFAULT null, raw_fat TEXT DEFAULT null, raw_oil TEXT DEFAULT null, chromium TEXT DEFAULT null, molybdenum TEXT DEFAULT null, field_horsetail TEXT DEFAULT null, ascophyllum TEXT DEFAULT null, dry_yeast TEXT DEFAULT null, omega_3 TEXT DEFAULT null, omega_6 TEXT DEFAULT null, potassium_iodide TEXT DEFAULT null, manganese TEXT DEFAULT null, manganese_sulfate TEXT DEFAULT null, manganese_sulfate_monohydrate TEXT DEFAULT null, manganese_oxide TEXT DEFAULT null, cassia_gum TEXT DEFAULT null, copper_sulfate_pentahydrate TEXT DEFAULT null, iron_sulfate_monohydrate TEXT DEFAULT null, folinic_acid TEXT DEFAULT null, nmes TEXT DEFAULT null, nfe_carbohydrate TEXT DEFAULT null, cobalt_sulfate TEXT DEFAULT null, fish_oil TEXT DEFAULT null, epa TEXT DEFAULT null, dha TEXT DEFAULT null, dha_epa TEXT DEFAULT null, crude_ash TEXT DEFAULT null, inulin TEXT DEFAULT null, beta_glucans TEXT DEFAULT null, misc TEXT DEFAULT null, updated TEXT DEFAULT null, FOREIGN KEY (barcode) REFERENCES products(barcode) )')
	.run()
products
	.prepare('CREATE INDEX IF NOT EXISTS `nutritions_lookup` ON `nutritions` ( `barcode` )')
	.run()
products
	.prepare('CREATE INDEX IF NOT EXISTS `nutritions_last_updated` ON `nutritions` ( `updated` )')
	.run()

products
	.prepare('CREATE TABLE IF NOT EXISTS beverages ( barcode PRIMARY KEY, description TEXT DEFAULT null, flavor TEXT DEFAULT null, dryness TEXT DEFAULT null, serving_suggestions TEXT DEFAULT null, country TEXT DEFAULT null, region TEXT DEFAULT null, producer TEXT DEFAULT null, year TEXT DEFAULT null, grape TEXT DEFAULT null, size TEXT DEFAULT null, closure TEXT DEFAULT null, alcohol TEXT DEFAULT null, country_detail TEXT DEFAULT null, region_detail TEXT DEFAULT null, grapes_detail TEXT DEFAULT null, producer_detail TEXT DEFAULT null, reviews TEXT DEFAULT null, updated TEXT DEFAULT null, FOREIGN KEY (barcode) REFERENCES products(barcode) )')
	.run()
products
	.prepare('CREATE INDEX IF NOT EXISTS `beverages_lookup` ON `beverages` ( `barcode` )')
	.run()
products
	.prepare('CREATE INDEX IF NOT EXISTS `beverages_last_updated` ON `beverages` ( `updated` )')
	.run()

// Creates table and index for cache db
cache
  .prepare('CREATE TABLE IF NOT EXISTS "voices" ( `barcode` TEXT, `voice_for` TEXT, `file_type` TEXT NOT NULL, PRIMARY KEY(`voice_for`,`barcode`) )')
  .run()

cache
  .prepare('CREATE INDEX IF NOT EXISTS `voices_lookup` ON `voices` ( `barcode`, `voice_for` )')
  .run()

allergies
  .prepare('CREATE TABLE IF NOT EXISTS "allergy" ( `allergen` TEXT, `food_group` TEXT NOT NULL, PRIMARY KEY(`allergen`) )')
  .run()

allergies
  .prepare('CREATE INDEX IF NOT EXISTS `allergy_lookup` ON `allergy` ( `allergen`, `food_group` )')
  .run()

class Allergy {
  static all (code) {
    return allergies.prepare('SELECT * FROM allergy').all()
  }
  static foodGroups () {
    return allergies.prepare('SELECT DISTINCT food_group from allergy').all()
  }

  static get_foodGroups (allergen) {
    return allergies.prepare('SELECT * from allergy WHERE food_group = ?').all(allergen.allergen)
  }
}

// Creating table and indexes to cache nutritions
class ProductInfo {
  static all () {
    return products.prepare('SELECT * FROM products').all()
  }

  static allNutritions () {
    return products.prepare('SELECT * FROM nutritions').all()
  }

  static allergy () {
    return products.prepare('SELECT DISTINCT allergens FROM products WHERE allergens IS NOT NULL').all()
  }  

  // Gets all information from specified barcode
  static get_product_info (barcode) {
    let product_info =  products.prepare('SELECT * FROM products AS p LEFT JOIN nutritions AS n ON p.barcode = n.barcode WHERE p.barcode = ?').get(barcode.barcode)
    if (product_info) {
      product_info.barcode = barcode.barcode
    }
    return product_info
  }
}

class Cache {
  // Inserts file that has been cached
  static insertReceivedVoice (product) {
    cache.prepare('INSERT or REPLACE INTO voices(barcode, voice_for, file_type) VALUES (?, ?, ?)').run(product.barcode, product.voice_for, product.file_type)
  }

  // Check if file has been cached
  static cachedVoices (voice) {
    return cache.prepare('SELECT barcode, voice_for, file_type FROM voices WHERE barcode = ? AND voice_for = ?').get(voice.barcode, voice.voice_for)
  }
}

module.exports = products
module.exports = cache
module.exports = allergies
module.exports.ProductInfo = ProductInfo
module.exports.Cache = Cache
module.exports.Allergy = Allergy
