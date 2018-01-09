/* Event handler for Chart and Histogram window. */
window.onresize = function () {
  let svg = document.getElementById('data-viz')
  let scale = (window.innerHeight / svg.height.animVal.valueInSpecifiedUnits) - 0.5
  let margin = parseInt(
    (window.innerWidth - (svg.width.animVal.valueInSpecifiedUnits * scale)) / 4
  )
  margin += 'px'
  svg.setAttribute('style', 'transform: scale(' +
    scale + ');overflow: hidden;margin-left: ' + margin + ';')
}
