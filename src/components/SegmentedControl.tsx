import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/styles';

type Props<T extends string> = {
  onSelect: (value: T) => void;
  options: { key: T; label: string }[];
  selected: T;
};

export function SegmentedControl<T extends string>({ onSelect, options, selected }: Props<T>) {
  return (
    <View style={styles.segmentRow}>
      {options.map((option) => (
        <Pressable
          accessibilityRole="button"
          key={option.key}
          onPress={() => onSelect(option.key)}
          style={[styles.segmentButton, selected === option.key && styles.segmentButtonActive]}
        >
          <Text style={[styles.segmentText, selected === option.key && styles.segmentTextActive]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
