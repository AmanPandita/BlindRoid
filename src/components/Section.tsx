import { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { styles } from '../styles/styles';

type Props = {
  children: ReactNode;
  eyebrow: string;
  title: string;
};

export function Section({ children, eyebrow, title }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}
