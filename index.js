const utils = require('./utils')

const DEFAULT_CLASS_ATTRIBUTE = 'styleName'
const CSSTA_TEMPLATE = 'styled'
const NEW_TAG_PREFIX = 'Styled'

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
  const processedItems = []

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

  function getUniqueStyledTag (className) {
    const capitalized = className.charAt(0).toUpperCase() + className.slice(1)
    const uniqueName = program.scope.generateUidIdentifier(capitalized).name
    return NEW_TAG_PREFIX + uniqueName
  }

  function processItem (JSXOpeningElement, className) {
    const oldTag = JSXOpeningElement.node.name.name
    let item = processedItems.find(i => (
      i.className === className && i.oldTag === oldTag
    ))
    let initNewTag = false

    if (!item) {
      initNewTag = true
      const newTag = getUniqueStyledTag(className)
      item = {
        className,
        oldTag,
        newTag
      }
      processedItems.push(item)
    }

    replaceWithNewTag(JSXOpeningElement, item.newTag)

    if (initNewTag) {
      let styles = utils.getStylesMatchingClassFromAst(ast, className)
      styles = utils.transformStylesForCssta(styles, className)
      const animate = utils.hasAnimation(styles) && utils.isAnimatable(item.oldTag)
      const oldTagExpr = getOldTagExpr(item.oldTag, animate)
      const newTagExpr = getNewTagExpr(item.newTag, oldTagExpr, styles)
      lastImport.insertAfter(newTagExpr)
    }
  }

  function replaceWithNewTag (JSXOpeningElement, newTag) {
    JSXOpeningElement.get('name').replaceWith(t.jSXIdentifier(newTag))

    if (!JSXOpeningElement.node.selfClosing) {
      JSXOpeningElement.getSibling('closingElement').get('name').replaceWith(t.jSXIdentifier(newTag))
    }
  }

  function getOldTagExpr (oldTag, animate) {
    if (animate) {
      // TODO: add import Animated from 'react-native'
      importAnimated = true
      return t.memberExpression(t.identifier('Animated'), t.identifier(oldTag))
    } else {
      return t.identifier(oldTag)
    }
  }

  function getNewTagExpr (newTag, oldTagExpr, styles) {
    const styled = t.taggedTemplateExpression(
      t.callExpression(csstaTemplate, [oldTagExpr]),
      t.templateLiteral([
        t.templateElement({ raw: '\n' + styles + '\n' })
      ], [])
    )

    const d = t.variableDeclarator(t.identifier(newTag), styled)
    return t.variableDeclaration('const', [d])
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
      processItem(JSXOpeningElement, className)
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
        ast = utils.parseAst(state.file.opts.filename, path.node.source.value)
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
