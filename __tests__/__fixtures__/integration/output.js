import _styled from "cssta/native";
import React from "react";
import "./styles.css";
import { View, Text, Animated } from "react-native";
const Styled_Header = _styled(Text)`
& {
  font-size: 24px;
  line-height: 32px;
}

&[@bold] {
  font-weight: bold;
}
`;
const Styled_Content = _styled(View)`
& {
  background-color: rgba(0, 60, 120, 0.5);
}

&[@full] {
  flex: 1;
  min-height: 100vh;
}
`;
const Styled_Button2 = _styled(View)`
& {
  font-size: 12px;
}

@media (min-width: 500px) {
  &[@variant='primary'] {
    color: red;
  }
}
`;
const Styled_Button = _styled(Text)`
& {
  font-size: 12px;
}

@media (min-width: 500px) {
  &[@variant='primary'] {
    color: red;
  }
}
`;
const Styled_Topbar = _styled(Animated.View)`
& {
  height: 40px;
  background-color: var(--bgColor);
  transition: opacity 0.3s;
}

&[@transparent] {
  opacity: 0.2;
}

&[@size='l'] {
  height: 60px;
}

&[@size='s'] {
  height: 30px;
}

@media (max-width: 600px) {
  &[@size='s'] {
    height: 20px;
  }
}
`;
const Styled_Root = _styled(View)`
& {
  flex: 1;
  --color: black;
  --bgColor: white;
  color: var(--color);
  background-color: var(--bgColor);
}

&[@theme='dark'] {
  --color: white;
  --bgColor: black;
}
`;
export default function App() {
  return (
    <>
      <Styled_Root theme="dark">
        <Styled_Topbar transparent size="m">
          <Styled_Button size="s" variant="primary" disabled>
            Click me
          </Styled_Button>
          <Styled_Button variant="secondary">Cancel</Styled_Button>
          <Styled_Button2 size="m">Another button tag</Styled_Button2>
        </Styled_Topbar>
        <Styled_Content full>
          <Styled_Header bold>Header</Styled_Header>
        </Styled_Content>
      </Styled_Root>
    </>
  );
}
