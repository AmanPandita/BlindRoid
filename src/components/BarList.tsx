import { Text, View } from 'react-native';

import { palette } from '../constants';
import { styles } from '../styles/styles';
import { RankedRow } from '../types';

type Props = { rows: RankedRow[] };

export function BarList({ rows }: Props) {
  if (!rows.length) {
    return <Text style={styles.emptyText}>No telemetry available.</Text>;
  }

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <View style={styles.barList}>
      {rows.map((row, index) => (
        <View key={row.label} style={styles.barRow}>
          <View style={styles.barLabelRow}>
            <Text style={styles.barLabel}>{row.label}</Text>
            <Text style={styles.barValue}>{row.value.toLocaleString()}</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: index === 0 ? palette.red : palette.ink,
                  width: `${Math.max((row.value / max) * 100, 5)}%`,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
