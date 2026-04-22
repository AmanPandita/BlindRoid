import { TextInput, View } from 'react-native';
import { Text } from 'react-native';

import { palette } from '../constants';
import { styles } from '../styles/styles';

type Props = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
};

export function Header({ onSearchChange, searchPlaceholder, searchValue }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.logoRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>b{'\n'}WARN{'\n'}ed</Text>
        </View>
        {onSearchChange && (
          <TextInput
            autoCapitalize="none"
            clearButtonMode="while-editing"
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder || 'Search'}
            placeholderTextColor={palette.muted}
            style={styles.headerSearchInput}
            value={searchValue}
          />
        )}
      </View>
    </View>
  );
}
