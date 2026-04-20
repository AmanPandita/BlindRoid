import { useState } from 'react';
import { Text, View } from 'react-native';

import { noticeRanges } from '../constants';
import { styles } from '../styles/styles';
import { NoticeRangeKey, WarnNotice } from '../types';
import { filterNotices, getNoticesForRange, noticeRangeTitle } from '../utils/analytics';
import { NoticeRow } from '../components/NoticeRow';
import { ScreenShell } from '../components/ScreenShell';
import { Section } from '../components/Section';
import { SegmentedControl } from '../components/SegmentedControl';

// ─── Wrapper ───────────────────────────────────────────────────────────────

type WrapperProps = { error: string | null; loading: boolean; notices: WarnNotice[] };

export function NoticesScreenWrapper({ error, loading, notices }: WrapperProps) {
  const [noticeQuery, setNoticeQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [logoRefreshKey, setLogoRefreshKey] = useState(0);

  async function handleRefresh() {
    setRefreshing(true);
    setLogoRefreshKey((k) => k + 1);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRefreshing(false);
  }

  return (
    <ScreenShell
      error={error}
      loading={loading}
      onRefresh={handleRefresh}
      onSearchChange={setNoticeQuery}
      refreshing={refreshing}
      searchPlaceholder="Search notices"
      searchValue={noticeQuery}
    >
      <NoticesScreen
        logoRefreshKey={logoRefreshKey}
        notices={notices}
        noticeQuery={noticeQuery}
      />
    </ScreenShell>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

type ScreenProps = { logoRefreshKey: number; notices: WarnNotice[]; noticeQuery: string };

function NoticesScreen({ logoRefreshKey, notices, noticeQuery }: ScreenProps) {
  const [range, setRange] = useState<NoticeRangeKey>('30d');
  const [expandedNotice, setExpandedNotice] = useState<string | null>(null);
  const visibleNotices = filterNotices(getNoticesForRange(notices, range), noticeQuery);

  return (
    <View style={styles.screen}>
      <SegmentedControl options={noticeRanges} selected={range} onSelect={setRange} />
      <Section eyebrow="Company tape" title={noticeRangeTitle(range)}>
        {visibleNotices.length ? (
          visibleNotices.map((notice) => (
            <NoticeRow
              key={notice.id}
              isExpanded={expandedNotice === notice.id}
              logoRefreshKey={logoRefreshKey}
              notice={notice}
              onToggle={() =>
                setExpandedNotice(expandedNotice === notice.id ? null : notice.id)
              }
            />
          ))
        ) : (
          <Text style={styles.emptyText}>No matching WARN notices.</Text>
        )}
      </Section>
    </View>
  );
}
