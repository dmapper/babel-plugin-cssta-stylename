const fs = require('fs')
const path = require('path')
const rem2pixel = require('@startupjs/postcss-rem-to-pixel')
const stylus = require('stylus')
const stylusHashPlugin = require('@dmapper/stylus-hash-plugin')
const poststylus = require('poststylus')

// TODO: Move startupjs-specific hardcode into plugin options
// ref: https://github.com/dmapper/react-native-stylus-transformer/blob/release/index.js#L34
exports.processStylus = function processStylus (src, filename) {
  const STYLES_PATH = path.join(process.cwd(), 'styles/index.styl')
  const CONFIG_PATH = path.join(process.cwd(), 'startupjs.config.js')
  let compiled

  // workaround stylus adding vendor prefixes to @keyframes
  src = 'vendors = official;\n' + src

  const compiler = stylus(src)
  compiler.set('filename', filename)

  // TODO: Make this a setting
  if (fs.existsSync(STYLES_PATH)) {
    compiler.import(STYLES_PATH)
  }

  // TODO: Make this a setting
  if (fs.existsSync(CONFIG_PATH)) {
    const { ui } = require(CONFIG_PATH)
    if (ui) compiler.use(stylusHashPlugin('$UI', ui))
  }

  // TODO: Make custom unit value a setting
  compiler.use(poststylus([rem2pixel])).render((err, res) => {
    if (err) {
      throw new Error(err)
    }
    compiled = res
  })

  return compiled
}
