const upstreamTransformer = require('metro-react-native-babel-transformer')

module.exports.transform = function ({ src, filename, options }) {
  if (/\.(css|styl)$/.test(filename)) {
    return upstreamTransformer.transform({
      src: 'module.exports = ' + JSON.stringify(src),
      filename,
      options
    })
  }
  return upstreamTransformer.transform({ src, filename, options })
}
