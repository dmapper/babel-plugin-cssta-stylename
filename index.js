const utils = require('./utils')

const DEFAULT_CLASS_ATTRIBUTE = 'styleName'
const CSSTA_TEMPLATE = 'styled'
const NEW_TAG_PREFIX = 'Styled'

function isTargetAttr (attribute, classAttribute) {
  if (!classAttribute) classAttribute = DEFAULT_CLASS_ATTRIBUTE
  return attribute.name.name === classAttribute
}

module.exports = ({ types: t }) => {
  let lastImport
  let stylesImport
  let program
  let csstaTemplate
  let importAnimated // TODO: Add Animated import automatically
  let hasTransformedClassName
  let ast
  let processedItems = []

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
        t.templateElement({
          raw: `\n${styles}\n`.replace(/\\|`|\${/g, '\\$&'),
          cooked: `\n${styles}\n`
        })
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
      lastImport = null
      stylesImport = null
      program = null
      csstaTemplate = null
      importAnimated = null
      hasTransformedClassName = null
      ast = null
      processedItems = []
    },
    visitor: {
      Program: {
        enter (path, state) {
          if (stylesImport) return

          path
            .get('body')
            .forEach(p => {
              if (p.isImportDeclaration()) {
                lastImport = p
                if (p.node.specifiers.length === 0 && /\.css$/.test(p.node.source.value)) {
                  stylesImport = p
                }
              }
            })

          if (!stylesImport) return
          program = path
          csstaTemplate = path.scope.generateUidIdentifier(CSSTA_TEMPLATE)

          try {
            ast = utils.parseAst(state.file.opts.filename, stylesImport.node.source.value)
          } catch (e) {
            throw new Error('Error parsing CSS file "' + state.file.opts.filename + '": ' + e.message || e)
          }

          const csstaSpecifier = t.importDefaultSpecifier(csstaTemplate)
          const csstaImport = t.importDeclaration([csstaSpecifier], t.stringLiteral('cssta/native'))
          const [newPath] = path.unshiftContainer('body', csstaImport)
          for (const specifier of newPath.get('specifiers')) {
            path.scope.registerBinding('module', specifier)
          }
        }
      },

      JSXOpeningElement (path, params) {
        if (!stylesImport) return
        if (!ast) return
        processClass(path, params.opts)
      }
    }
  }
}
