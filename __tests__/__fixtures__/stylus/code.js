import React from 'react'
import './styles.styl'
import { View, Text, Animated } from 'react-native'

export default function App () {
  return <>
    <View styleName='root' theme='dark'>
      <View styleName='topbar' transparent size='m'>
        <Text styleName='button' size='s' variant='primary' disabled>
          Click me
        </Text>
        <Text styleName='button' variant='secondary'>
          Cancel
        </Text>
        <View styleName='button' size='m'>
          Another button tag
        </View>
      </View>
      <View styleName='content' full>
        <Text styleName='header' bold>
          Header
        </Text>
      </View>
    </View>
  </>
}
