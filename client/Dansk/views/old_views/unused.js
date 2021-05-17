app.get('/general-information', (req, res) => {
  const product = Cached.get_general_info(recentScan.toString('utf8'))
  let textToBeRead = {}
  const title = product.name + "'s " + 'General Information'
  const name = product.name
  if (product) {
    for (let i in product) {
      let newIndex = i
      if (i.includes('_')) {
        newIndex = newIndex.replace('_', ' ')
      }
      if (product[i] !== null && i !== 'name') {
        textToBeRead[newIndex] = product[i]
      }
    }
  }
  else {
    textToBeRead = []
  }

  res.render('general-information', {
    siteTitle: title,
    name: name,
    topMenuText: textToBeRead,
    bottomLeftText: 'Read aloud',
    bottomRightLink: '/scanned',
    bottomRightText: 'Go Back'
  })
})