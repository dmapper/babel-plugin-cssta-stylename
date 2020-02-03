const fs = require('fs')
const css = require('css')
const nodePath = require('path')

exports.parseAst = function parseAst (modulePath, cssPath) {
  const pathHint = modulePath.charAt(0)
  const pathReference = pathHint === '/'
    ? nodePath.dirname(modulePath)
    : nodePath.join(process.cwd(), nodePath.dirname(modulePath))

  const cssPathHint = cssPath.charAt(0)
  const cssPathReference = (cssPathHint === '/'
    ? cssPath
    : cssPathHint === '.'
      ? nodePath.join(pathReference, cssPath)
      : require.resolve(cssPath)
  )
  const cssString = fs.readFileSync(cssPathReference, 'utf-8')
  return css.parse(cssString, { source: cssPathReference })
}

exports.getStylesMatchingClassFromAst = function getStylesMatchingClassFromAst (ast, className) {
  const regex = new RegExp(`\\.${className}(?:[^\\w\\-]|$)`)
  let keyframes = []

  const newAst = getNewAst(ast.stylesheet.rules.map(rule => {
    if (rule.type === 'keyframes') {
      keyframes.push(rule)
    } else {
      return matchRule(rule, regex)
    }
  }).filter(Boolean))

  let matchingCss = css.stringify(newAst) || ''
  keyframes = keyframes.filter(({ name }) => (
    name && new RegExp('[:,\\s]' + name + '[:,\\s]').test(matchingCss)
  ))
  if (keyframes.length > 0) {
    matchingCss += (matchingCss ? '\n' : '') + css.stringify(getNewAst(keyframes))
  }
  return matchingCss
}

function getNewAst (rules) {
  return {
    type: 'stylesheet',
    stylesheet: {
      rules: rules
    }
  }
}

function matchRule (rule, regex) {
  if (rule.rules) {
    const rules = rule.rules.map(rule => matchRule(rule, regex)).filter(Boolean)
    if (rules.length > 0) return { ...rule, rules }
  } else if (rule.selectors) {
    const selectors = rule.selectors.filter(selector => regex.test(selector))
    if (selectors.length > 0) return { ...rule, selectors }
  }
}

exports.transformStylesForCssta = function transformStylesForCssta (styles, className) {
  // replace class with &
  const replaceClassPattern = `\\.${className}([^\\w\\-]|$)`
  styles = styles.replace(new RegExp(replaceClassPattern, 'g'), '&$1')

  // prepend @ to all attribute names
  styles = styles.replace(/\[/g, '[@')

  return styles
}

exports.isAnimatable = function isAnimatable (tag) {
  return ['View', 'Text', 'Image'].includes(tag)
}

exports.hasAnimation = function hasAnimation (styles) {
  return /(?:animation:|transition:)/.test(styles)
}

// Check if .js file with the same name exists.
// If it does -- check if it uses the css file (filename).
// If it does -- check if
exports.maybeUpdateCssHash = function maybeUpdateCssHash (filename) {
  let componentName = filename.match(/\/([^/]+)\.css$/)
  componentName = componentName && componentName[1]
  const jsFileName = `./${componentName}.js`
  if (!fs.existsSync(jsFileName)) return
  let jsFile = fs.readFileSync(jsFileName, { encoding: 'utf8' })
  if (!new RegExp(`\\.\\/${componentName}\\.css['"]`).test(jsFile)) return
  const content = fs.readFileSync(filename, { encoding: 'utf8' })
  const newHash = hashCode(content)
  let oldHash = jsFile.match(/@css_hash_([\d-]+)/)
  oldHash = oldHash && oldHash[1]
  if (~~oldHash === ~~newHash) return
  jsFile = jsFile.replace(new RegExp(`(\\.\\/${componentName}\\.css['"])[^\\n]*\n`), `$1 // @css_hash_${newHash}\n`)
  fs.writeFileSync(jsFileName, jsFile)
  console.log('[babel-plugin-cssta-stylename] updated @css_hash in', jsFileName)
}

function hashCode (source) {
  let hash = 0
  if (source.length === 0) return hash
  for (var i = 0; i < source.length; i++) {
    const char = source.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}

exports.getReactImport = function getReactImport (t, path) {
  const allBindings = Object.values(path.scope.getAllBindingsOfKind('module'))
  const allImportBindings = allBindings.filter(reference =>
    t.isImportDefaultSpecifier(reference.path.node)
  )
  const importBindingsForModule = allImportBindings.filter(reference => {
    const importDeclaration = reference.path.findParent(t.isImportDeclaration)
    const importModuleName = importDeclaration.node.source.value
    return importModuleName === 'react'
  })
  return importBindingsForModule[0] && t.cloneDeep(importBindingsForModule[0].identifier)
}
