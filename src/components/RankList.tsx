import { useState } from 'react';
import { Text, View } from 'react-native';

import { styles } from '../styles/styles';
import { RankedRow } from '../types';
import { CompanyRow } from './CompanyRow';

type Props = {
  emptyLabel: string;
  logoRefreshKey?: number;
  rows: RankedRow[];
  showStock?: boolean;
};

export function RankList({ emptyLabel, logoRefreshKey, rows, showStock = false }: Props) {
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  if (!rows.length) {
    return <Text style={styles.emptyText}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.rankList}>
      {rows.map((row, index) => (
        <CompanyRow
          key={`${row.label}-${index}`}
          index={index}
          isExpanded={expandedCompany === row.label}
          logoRefreshKey={logoRefreshKey}
          onToggle={() =>
            setExpandedCompany(expandedCompany === row.label ? null : row.label)
          }
          row={row}
          showStock={showStock}
        />
      ))}
    </View>
  );
}
