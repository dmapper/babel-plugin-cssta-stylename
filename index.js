const utils = require('./utils')

const DEFAULT_CLASS_ATTRIBUTE = 'styleName'
const DEFAULT_ADD_CSS_HASH = false
const DEFAULT_EXTENSIONS = ['css', 'styl']
const ADD_CSS_HASH_DELAY = 300
const CSSTA_TEMPLATE = 'styled'
const NEW_TAG_PREFIX = 'Styled'

function isTargetAttr (attribute, classAttribute) {
  if (!classAttribute) classAttribute = DEFAULT_CLASS_ATTRIBUTE
  return attribute.name.name === classAttribute
}

function hasTargetExtension (filename = '', extensions = DEFAULT_EXTENSIONS) {
  const match = filename.match(/\.([^/]+)$/)
  const extension = match && match[1]
  return extension && extensions.includes(extension)
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
      const newTagExpr = getNewTagExpr(item.newTag, oldTagExpr, styles, JSXOpeningElement)
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

  function getNewTagExpr (newTag, oldTagExpr, styles, path) {
    const styled = t.taggedTemplateExpression(
      t.callExpression(csstaTemplate, [oldTagExpr]),
      t.templateLiteral([
        t.templateElement({
          raw: `\n${styles}\n`.replace(/\\|`|\${/g, '\\$&'),
          cooked: `\n${styles}\n`
        })
      ], [])
    )
    const reactIdentifier = utils.getReactImport(t, path)
    // TODO: Make React.memo() optional through settings
    const memoed = t.callExpression(t.memberExpression(reactIdentifier, t.identifier('memo')), [styled])
    const d = t.variableDeclarator(t.identifier(newTag), memoed)
    return t.variableDeclaration('const', [d])
  }

  function processClass (JSXOpeningElement, state) {
    var className = null

    JSXOpeningElement.traverse({
      JSXAttribute (JSXAttribute) {
        if (!isTargetAttr(JSXAttribute.node, state.opts.classAttribute)) return

        if (t.isStringLiteral(JSXAttribute.node.value)) {
          var classNameValue = JSXAttribute.node.value.value.split(' ')
          className = classNameValue[0]
          if (classNameValue.length > 1) {
            // TODO: Maybe throw an error when more than 1 class specified
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

  function maybeUpdateCssHash (delayExecution, state) {
    // Force update JS file in the same directory with the new css file hash.
    // This is required for proper development experience on native and web.
    // TODO: Make this a plugin option and only enabled in dev env.
    const addCssHash = state.opts.addCssHash != null
      ? state.opts.addCssHash
      : DEFAULT_ADD_CSS_HASH
    if (addCssHash && hasTargetExtension(state.file.opts.filename, state.opts.extensions)) {
      const filename = state.file.opts.filename
      // Delay execution to account for Save All delay in IDEs
      if (delayExecution) {
        setTimeout(() => {
          utils.maybeUpdateCssHash(filename)
        }, ADD_CSS_HASH_DELAY)
      } else {
        utils.maybeUpdateCssHash(filename)
      }
    }
  }

  return {
    post () {
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
                if (hasTargetExtension(p.node.source.value, state.opts.extensions)) stylesImport = p
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
          const [newPath] = program.unshiftContainer('body', csstaImport)

          for (const specifier of newPath.get('specifiers')) {
            program.scope.registerBinding('module', specifier)
          }
        },
        exit (path, state) {
          lastImport = null
          stylesImport = null
          program = null
          csstaTemplate = null
          importAnimated = null
          hasTransformedClassName = null
          ast = null
          processedItems = []

          maybeUpdateCssHash(true, state)
        }
      },

      JSXOpeningElement (path, state) {
        if (!stylesImport) return
        if (!ast) return
        processClass(path, state)
      }
    }
  }
}
