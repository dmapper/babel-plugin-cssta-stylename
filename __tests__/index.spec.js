import path from 'path'
import pluginTester from 'babel-plugin-tester'
import plugin from '../index'
import babel from '@babel/core'

pluginTester({
  plugin,
  pluginName: 'babel-plugin-cssta-stylename',
  fixtures: path.join(__dirname, '__fixtures__'),
  babel,
  babelOptions: {
    plugins: ['@babel/plugin-syntax-jsx'],
    babelrc: false
    // filename: 'index.js'
  }
})
