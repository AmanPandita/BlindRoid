import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { companyRanges } from '../constants';
import { styles } from '../styles/styles';
import { Analytics, CompanyRangeKey } from '../types';
import {
  filterRankedRows,
  getIndustryRowsForRange,
  getRegionRowsForRange,
} from '../utils/analytics';
import { BarList } from '../components/BarList';
import { ScreenShell } from '../components/ScreenShell';
import { Section } from '../components/Section';
import { SegmentedControl } from '../components/SegmentedControl';

// ─── Wrapper ───────────────────────────────────────────────────────────────

type WrapperProps = { analytics: Analytics; error: string | null; loading: boolean };

export function RegionsScreenWrapper({ analytics, error, loading }: WrapperProps) {
  const [regionQuery, setRegionQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [localAnalytics, setLocalAnalytics] = useState(analytics);

  useEffect(() => {
    setLocalAnalytics(analytics);
  }, [analytics]);

  async function handleRefresh() {
    setRefreshing(true);
    setLocalAnalytics({ ...analytics });
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRefreshing(false);
  }

  return (
    <ScreenShell
      error={error}
      loading={loading}
      onRefresh={handleRefresh}
      onSearchChange={setRegionQuery}
      refreshing={refreshing}
      searchPlaceholder="Search states or industries"
      searchValue={regionQuery}
    >
      <RegionsScreen analytics={localAnalytics} regionQuery={regionQuery} />
    </ScreenShell>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

type ScreenProps = { analytics: Analytics; regionQuery: string };

function RegionsScreen({ analytics, regionQuery }: ScreenProps) {
  const [range, setRange] = useState<CompanyRangeKey>('30d');
  const stateRows = filterRankedRows(getRegionRowsForRange(analytics, range), regionQuery);
  const industryRows = filterRankedRows(getIndustryRowsForRange(analytics, range), regionQuery);

  const stateTitle =
    range === '7d' ? 'State exposure, last 7 days'
    : range === '30d' ? 'State exposure, last 30 days'
    : 'State exposure, all time';

  const industryTitle =
    range === '7d' ? 'Industry stress, last 7 days'
    : range === '30d' ? 'Industry stress, last 30 days'
    : 'Industry stress, all time';

  return (
    <View style={styles.screen}>
      <SegmentedControl options={companyRanges} selected={range} onSelect={setRange} />
      <Section eyebrow="Geography" title={stateTitle}>
        <BarList rows={stateRows} />
      </Section>
      <Section eyebrow="Sectors" title={industryTitle}>
        <BarList rows={industryRows} />
      </Section>
    </View>
  );
}
