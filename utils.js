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
  const newAst = {
    type: 'stylesheet',
    stylesheet: {
      rules: []
    }
  }
  newAst.stylesheet.rules = ast.stylesheet.rules.map(rule => {
    if (rule.type === 'media') {
      const rules = rule.rules.map(rule => {
        if (rule.type === 'rule') {
          const selectors = rule.selectors.map(selector => {
            if (regex.test(selector)) return selector
          }).filter(Boolean)
          if (selectors.length > 0) return { ...rule, selectors }
        }
      }).filter(Boolean)
      if (rules.length > 0) return { ...rule, rules }
    } else if (rule.type === 'keyframes') {
      return rule
    } else if (rule.type === 'rule') {
      const selectors = rule.selectors.map(selector => {
        if (regex.test(selector)) return selector
      }).filter(Boolean)
      if (selectors.length > 0) return { ...rule, selectors }
    }
  }).filter(Boolean)

  return css.stringify(newAst)
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
