import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { styles } from '../styles/styles';
import { RootTabParamList } from '../types';

type Props = { color: string; focused: boolean; name: keyof RootTabParamList };

export function TabGlyph({ color, focused, name }: Props) {
  return (
    <View style={[styles.tabGlyph, focused && styles.tabGlyphActive]}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        {renderIcon(name, color)}
      </Svg>
    </View>
  );
}

function renderIcon(name: keyof RootTabParamList, color: string) {
  switch (name) {
    case 'Overview':
      return (
        <>
          <Path d="M4 18V9" stroke={color} strokeLinecap="round" strokeWidth={2.3} />
          <Path d="M10 18V5" stroke={color} strokeLinecap="round" strokeWidth={2.3} />
          <Path d="M16 18v-7" stroke={color} strokeLinecap="round" strokeWidth={2.3} />
          <Path d="M22 18v-4" stroke={color} strokeLinecap="round" strokeWidth={2.3} />
        </>
      );
    case 'Companies':
      return (
        <>
          <Path d="M5 20V6.5L12 3l7 3.5V20" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={2.1} />
          <Path d="M9 20v-5h6v5" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={2.1} />
          <Path d="M9 9h.01M12 9h.01M15 9h.01" stroke={color} strokeLinecap="round" strokeWidth={3} />
        </>
      );
    case 'Regions':
      return (
        <>
          <Circle cx={12} cy={10} r={3} fill="none" stroke={color} strokeWidth={2.1} />
          <Path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={2.1} />
        </>
      );
    case 'Notices':
      return (
        <>
          <Path d="M7 4h8l3 3v13H7z" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={2.1} />
          <Path d="M14 4v4h4M10 12h5M10 16h5" stroke={color} strokeLinecap="round" strokeWidth={2.1} />
        </>
      );
    case 'Reddit':
      return (
        <>
          <Circle cx={12} cy={12} r={10} fill="none" stroke={color} strokeWidth={2.1} />
          <Circle cx={9} cy={10} r={1.5} fill={color} />
          <Circle cx={15} cy={10} r={1.5} fill={color} />
          <Path d="M8 15c0 0 1.5 2 4 2s4-2 4-2" fill="none" stroke={color} strokeLinecap="round" strokeWidth={2.1} />
        </>
      );
  }
}
