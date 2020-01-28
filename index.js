const fs = require('fs')
const css = require('css')
const nodePath = require('path')

const DEFAULT_CLASS_ATTRIBUTE = 'styleName'
const CSSTA_TEMPLATE = 'styled'

function isTargetAttr (attribute, classAttribute) {
  if (!classAttribute) classAttribute = DEFAULT_CLASS_ATTRIBUTE
  return attribute.name.name === classAttribute
}

module.exports = (babel) => {
  const t = babel.types
  let lastImport
  let stylesImport
  let program
  let csstaTemplate
  let importAnimated  // TODO: Add Animated import automatically
  let hasTransformedClassName
  let ast
  const processItems = []

  function isRequire (node) {
    return (
      node &&
      node.declarations &&
      node.declarations[0] &&
      node.declarations[0].init &&
      node.declarations[0].init.callee &&
      node.declarations[0].init.callee.name === 'require'
    )
  }

  function processClass (JSXOpeningElement, opts) {
    var className = null

    JSXOpeningElement.traverse({
      JSXAttribute (JSXAttribute) {
        if (!isTargetAttr(JSXAttribute.node, opts.classAttribute)) return

        if (t.isStringLiteral(JSXAttribute.node.value)) {
          var classNameValue = JSXAttribute.node.value.value.split(' ')
          className = classNameValue[0]
          if (classNameValue.length > 1) {
            // TODO: Throw an error when more than 1 class specified
            JSXAttribute.get('value').replaceWith(t.stringLiteral(classNameValue.slice(1).join(' ')))
          } else {
            JSXAttribute.remove()
          }
        }
      }
    })

    if (className && stylesImport) {
      hasTransformedClassName = true

      const tag = JSXOpeningElement.node.name.name
      let item = processItems.find(i => i.className === className && i.tag === tag)

      if (!item) {
        const newTag = 'Styled' + program.scope.generateUidIdentifier(className[0].toUpperCase() + className.slice(1)).name
        item = {
          className,
          tag,
          newTag
        }
        processItems.push(item)
      }

      JSXOpeningElement.get('name').replaceWith(t.jSXIdentifier(item.newTag))

      if (!JSXOpeningElement.node.selfClosing) {
        JSXOpeningElement.getSibling('closingElement').get('name').replaceWith(t.jSXIdentifier(item.newTag))
      }

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

      let declarations = css.stringify(newAst)

      // replace class with &
      const replaceClassPattern = `\\.${className}([^\\w\\-]|$)`
      declarations = declarations.replace(new RegExp(replaceClassPattern, 'g'), '&$1')

      // prepend @ to all attribute names
      declarations = declarations.replace(/\[/g, '[@')

      const hasAnimation = /(?:animation:|transition:)/.test(declarations)

      let newTagExpression
      if (hasAnimation && isAnimatable(item.tag)) {
        // TODO: add import Animated from 'react-native'
        importAnimated = true
        newTagExpression = t.memberExpression(t.identifier('Animated'), t.identifier(item.tag))
      } else {
        newTagExpression = t.identifier(item.tag)
      }

      const styled = t.taggedTemplateExpression(
        t.callExpression(csstaTemplate, [newTagExpression]),
        t.templateLiteral([
          t.templateElement({ raw: '\n' + declarations + '\n' })
        ], [])
      )

      const d = t.variableDeclarator(t.identifier(item.newTag), styled)
      const definition = t.variableDeclaration('var', [d])

      lastImport.insertAfter(definition)
    }
  }

  return {
    post () {
      hasTransformedClassName = null
    },
    visitor: {
      Program: {
        enter (path, state) {
          program = path
          csstaTemplate = path.scope.generateUidIdentifier(CSSTA_TEMPLATE)

          // Find the last import to start writing cssta components after it
          lastImport = path
            .get('body')
            .filter(p => p.isImportDeclaration() || isRequire(p.node))
            .pop()
        },
        exit (path, state) {
        }
      },
      ImportDeclaration (path, state) {
        // Find css file import and parse its AST
        if (!(path.node.specifiers.length === 0 && /\.css$/.test(path.node.source.value))) return
        stylesImport = path
        ast = parseAst(state.file.opts.filename, path.node.source.value)
        path.insertBefore(t.importDeclaration([
          t.importDefaultSpecifier(csstaTemplate)
        ], t.stringLiteral('cssta/native')))
      },
      JSXElement (path, params) {
        path.traverse({
          JSXOpeningElement (path) {
            processClass(path, params.opts)
          }
        })
      }
    }
  }
}

function parseAst (modulePath, cssPath) {
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

function isAnimatable (tag) {
  return ['View', 'Text', 'Image'].includes(tag)
}
