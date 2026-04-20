import { Text, View } from 'react-native';

import { styles } from '../styles/styles';

type Props = { accent: string; detail: string; label: string; value: string };

export function MetricCard({ accent, detail, label, value }: Props) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}
