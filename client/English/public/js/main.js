const content = document.getElementById('text').innerHTML

$("#readText").on( "click", function() {
  $("#info > p").replaceWith(content)
  $( "#text" ).remove()
})

$("#readNutritions").on( "click", function() {
  $("#info > div").replaceWith(content)
  $( "#text" ).remove()
})
