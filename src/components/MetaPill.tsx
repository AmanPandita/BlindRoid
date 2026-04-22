import { Text, View } from 'react-native';

import { styles } from '../styles/styles';

type Props = { label: string; value: string };

export function MetaPill({ label, value }: Props) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
