import React from 'react';
import { ImageBackground } from 'react-native';

const BG_SOURCE = require('../../assets/icons/motif-islamique.png');
const BG_COLOR = '#F8F7F5';

export default function ScreenBackground({ children, style }) {
  return (
    <ImageBackground
      source={BG_SOURCE}
      style={[{ flex: 1, backgroundColor: BG_COLOR }, style]}
    >
      {children}
    </ImageBackground>
  );
}
