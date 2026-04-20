import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { companyRanges } from '../constants';
import { styles } from '../styles/styles';
import { Analytics, CompanyRangeKey } from '../types';
import {
  companyRangeTitle,
  filterRankedRows,
  getCompanyRowsForRange,
} from '../utils/analytics';
import { RankList } from '../components/RankList';
import { ScreenShell } from '../components/ScreenShell';
import { Section } from '../components/Section';
import { SegmentedControl } from '../components/SegmentedControl';

// ─── Wrapper ───────────────────────────────────────────────────────────────

type WrapperProps = { analytics: Analytics; error: string | null; loading: boolean };

export function CompaniesScreenWrapper({ analytics, error, loading }: WrapperProps) {
  const [companyQuery, setCompanyQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [logoRefreshKey, setLogoRefreshKey] = useState(0);
  const [localAnalytics, setLocalAnalytics] = useState(analytics);

  useEffect(() => {
    setLocalAnalytics(analytics);
  }, [analytics]);

  async function handleRefresh() {
    setRefreshing(true);
    setLocalAnalytics({ ...analytics });
    setLogoRefreshKey((k) => k + 1);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRefreshing(false);
  }

  return (
    <ScreenShell
      error={error}
      loading={loading}
      onRefresh={handleRefresh}
      onSearchChange={setCompanyQuery}
      refreshing={refreshing}
      searchPlaceholder="Search companies"
      searchValue={companyQuery}
    >
      <CompaniesScreen
        analytics={localAnalytics}
        companyQuery={companyQuery}
        logoRefreshKey={logoRefreshKey}
      />
    </ScreenShell>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

type ScreenProps = { analytics: Analytics; companyQuery: string; logoRefreshKey: number };

function CompaniesScreen({ analytics, companyQuery, logoRefreshKey }: ScreenProps) {
  const [range, setRange] = useState<CompanyRangeKey>('30d');
  const rows = filterRankedRows(getCompanyRowsForRange(analytics, range), companyQuery);

  return (
    <View style={styles.screen}>
      <SegmentedControl options={companyRanges} selected={range} onSelect={setRange} />
      <Section eyebrow="Companies" title={companyRangeTitle(range)}>
        <RankList
          emptyLabel="No matching company telemetry available."
          logoRefreshKey={logoRefreshKey}
          rows={rows}
          showStock
        />
      </Section>
    </View>
  );
}
