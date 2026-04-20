import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { companyRanges } from '../constants';
import { styles } from '../styles/styles';
import { Analytics, CompanyRangeKey, WarnNotice } from '../types';
import {
  buildAnalytics,
  filterRankedRows,
  getCompanyRowsForRange,
  getIndustriesTitle,
  getIndustryRowsForRange,
  getMomentumTitle,
  getRegionRowsForRange,
  getRegionsTitle,
  groupBy,
  rankGroups,
} from '../utils/analytics';
import { formatUpdateTime } from '../utils/format';
import { BarList } from '../components/BarList';
import { MetaPill } from '../components/MetaPill';
import { RankList } from '../components/RankList';
import { ScreenShell } from '../components/ScreenShell';
import { Section } from '../components/Section';
import { SegmentedControl } from '../components/SegmentedControl';

// ─── Wrapper (state + refresh) ─────────────────────────────────────────────

type WrapperProps = {
  analytics: Analytics;
  error: string | null;
  lastUpdatedAt: string | null;
  loading: boolean;
  notices: WarnNotice[];
  totalCount: number;
};

export function OverviewScreenWrapper({
  analytics,
  error,
  lastUpdatedAt,
  loading,
  notices,
  totalCount,
}: WrapperProps) {
  const [companyQuery, setCompanyQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [logoRefreshKey, setLogoRefreshKey] = useState(0);
  const [localAnalytics, setLocalAnalytics] = useState(analytics);

  useEffect(() => {
    setLocalAnalytics(analytics);
  }, [analytics]);

  async function handleRefresh() {
    setRefreshing(true);
    setLocalAnalytics(buildAnalytics(notices));
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
      <OverviewScreen
        analytics={localAnalytics}
        companyQuery={companyQuery}
        lastUpdatedAt={lastUpdatedAt}
        logoRefreshKey={logoRefreshKey}
        notices={notices}
        totalCount={totalCount}
      />
    </ScreenShell>
  );
}

// ─── Screen (display) ──────────────────────────────────────────────────────

type ScreenProps = {
  analytics: Analytics;
  companyQuery: string;
  lastUpdatedAt: string | null;
  logoRefreshKey: number;
  notices: WarnNotice[];
  totalCount: number;
};

function OverviewScreen({
  analytics,
  companyQuery,
  lastUpdatedAt,
  logoRefreshKey,
  notices,
}: ScreenProps) {
  const [range, setRange] = useState<CompanyRangeKey>('30d');
  const isSearching = companyQuery.trim().length > 0;

  const topCompanies = isSearching
    ? filterRankedRows(rankGroups(groupBy(notices, (n) => n.company || 'Unknown company')), companyQuery).slice(0, 5)
    : getCompanyRowsForRange(analytics, range).slice(0, 5);

  const topRegions = getRegionRowsForRange(analytics, range).slice(0, 5);
  const topIndustries = getIndustryRowsForRange(analytics, range).slice(0, 5);
  const momentumTitle = isSearching && topCompanies.length > 0 ? 'All Companies' : getMomentumTitle(range);

  return (
    <View style={styles.screen}>
      {!isSearching && (
        <SegmentedControl options={companyRanges} selected={range} onSelect={setRange} />
      )}

      <Section eyebrow="Momentum" title={momentumTitle}>
        <RankList
          emptyLabel={isSearching ? 'No matching companies found.' : 'No matching companies in the selected period.'}
          logoRefreshKey={logoRefreshKey}
          rows={topCompanies}
          showStock
        />
      </Section>

      {!isSearching && (
        <>
          <ScrollView
            contentContainerStyle={styles.horizontalSectionsContainer}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <View style={styles.horizontalSection}>
              <Text style={styles.horizontalSectionEyebrow}>Geography</Text>
              <Text style={styles.horizontalSectionTitle}>{getRegionsTitle(range)}</Text>
              <View style={styles.horizontalSectionBody}>
                <BarList rows={topRegions} />
              </View>
            </View>
            <View style={styles.horizontalSection}>
              <Text style={styles.horizontalSectionEyebrow}>Sectors</Text>
              <Text style={styles.horizontalSectionTitle}>{getIndustriesTitle(range)}</Text>
              <View style={styles.horizontalSectionBody}>
                <BarList rows={topIndustries} />
              </View>
            </View>
          </ScrollView>

          <View style={styles.metaRow}>
            <MetaPill
              label="Last updated"
              value={lastUpdatedAt ? formatUpdateTime(lastUpdatedAt) : 'Pending'}
            />
          </View>
        </>
      )}
    </View>
  );
}
