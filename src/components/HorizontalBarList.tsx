import { ScrollView, Text, View } from 'react-native';

import { palette } from '../constants';
import { styles } from '../styles/styles';
import { RankedRow } from '../types';

type Props = { rows: RankedRow[] };

export function HorizontalBarList({ rows }: Props) {
  if (!rows.length) {
    return <Text style={styles.emptyText}>No telemetry available.</Text>;
  }

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ScrollView
      contentContainerStyle={styles.horizontalBarList}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {rows.map((row, index) => (
        <View key={row.label} style={styles.horizontalBarCard}>
          <Text style={styles.horizontalBarLabel} numberOfLines={2}>
            {row.label}
          </Text>
          <Text style={styles.horizontalBarValue}>{row.value.toLocaleString()}</Text>
          <Text style={styles.horizontalBarSubtext}>workers</Text>
          <View style={styles.horizontalBarTrack}>
            <View
              style={[
                styles.horizontalBarFill,
                {
                  backgroundColor: index === 0 ? palette.red : palette.ink,
                  height: `${Math.max((row.value / max) * 100, 5)}%`,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
