import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

declare const process: {
  env: {
    EXPO_PUBLIC_WARN_FIREHOSE_API_KEY?: string;
  };
};

type RawWarnRecord = Record<string, unknown>;

type WarnNotice = {
  id: string;
  company: string;
  city: string;
  state: string;
  industry: string;
  date: string;
  employees: number;
  reason: string;
};

type CachePayload = {
  savedAt: string;
  notices: WarnNotice[];
};

type ScreenKey = 'overview' | 'companies' | 'regions' | 'notices';

type ChartPoint = {
  label: string;
  value: number;
};

type RankedRow = {
  label: string;
  value: number;
  notices: number;
  meta?: string;
};

const WARN_API_KEY = process.env.EXPO_PUBLIC_WARN_FIREHOSE_API_KEY ?? '';
const WARN_ENDPOINT = 'https://warnfirehose.com/api/records?limit=100';
const CACHE_KEY = 'warnfirehose.warn_notices.v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const palette = {
  page: '#f7f7f5',
  panel: '#ffffff',
  ink: '#171717',
  muted: '#686868',
  faint: '#e8e5df',
  soft: '#f0eeea',
  red: '#e64626',
  redSoft: '#fff0eb',
  amber: '#f59f00',
  blue: '#2563eb',
  green: '#12805c',
};

const tabs: { key: ScreenKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'companies', label: 'Companies' },
  { key: 'regions', label: 'Regions' },
  { key: 'notices', label: 'Notices' },
];

const sampleNotices: WarnNotice[] = [
  {
    id: 'sample-1',
    company: 'Aster Cloud Systems',
    city: 'San Jose',
    state: 'CA',
    industry: 'Technology',
    date: '2026-03-28',
    employees: 284,
    reason: 'Permanent layoff',
  },
  {
    id: 'sample-2',
    company: 'Northline Fulfillment',
    city: 'Columbus',
    state: 'OH',
    industry: 'Logistics',
    date: '2026-03-21',
    employees: 173,
    reason: 'Facility reduction',
  },
  {
    id: 'sample-3',
    company: 'Harbor Medical Group',
    city: 'Boston',
    state: 'MA',
    industry: 'Healthcare',
    date: '2026-03-16',
    employees: 96,
    reason: 'Unit closure',
  },
  {
    id: 'sample-4',
    company: 'Keystone Retail Brands',
    city: 'Dallas',
    state: 'TX',
    industry: 'Retail',
    date: '2026-02-26',
    employees: 341,
    reason: 'Plant closure',
  },
];

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>('overview');
  const [notices, setNotices] = useState<WarnNotice[]>([]);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCachedOrFetch();
  }, []);

  const analytics = useMemo(() => buildAnalytics(notices), [notices]);

  async function loadCachedOrFetch() {
    setLoading(true);
    setError(null);
    let hasCachedData = false;

    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const payload = JSON.parse(cached) as CachePayload;
        hasCachedData = Boolean(payload.notices.length);
        setNotices(payload.notices);
        setCachedAt(payload.savedAt);

        if (!isCacheExpired(payload.savedAt)) {
          return;
        }
      }

      await fetchAndCache();
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      if (!hasCachedData) {
        setNotices(sampleNotices);
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchAndCache() {
    if (!WARN_API_KEY) {
      throw new Error('Missing EXPO_PUBLIC_WARN_FIREHOSE_API_KEY in .env');
    }

    const response = await fetch(WARN_ENDPOINT, {
      headers: {
        'X-API-Key': WARN_API_KEY,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`WARN Firehose returned ${response.status}`);
    }

    const json = await response.json();
    const records = extractRecords(json).map(normalizeNotice).filter(Boolean) as WarnNotice[];

    if (!records.length) {
      throw new Error('No WARN notices were returned by the API');
    }

    const savedAt = new Date().toISOString();
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt, notices: records }));
    setNotices(records);
    setCachedAt(savedAt);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>B</Text>
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Blind x layoffs.fyi style</Text>
              <Text style={styles.title}>WARN layoff intelligence</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Minimal telemetry for WARN-only notices, cached locally and refreshed after 24 hours.
          </Text>

          <View style={styles.metaRow}>
            <MetaPill label="Source" value="/api/records" />
            <MetaPill label="Cache" value={cachedAt ? formatDateTime(cachedAt) : 'warming'} />
            <MetaPill label="Policy" value="24h TTL" />
          </View>
        </View>

        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable
              accessibilityRole="button"
              key={tab.key}
              onPress={() => setActiveScreen(tab.key)}
              style={[styles.tabButton, activeScreen === tab.key && styles.tabButtonActive]}
            >
              <Text style={[styles.tabText, activeScreen === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={palette.red} />
            <Text style={styles.loadingText}>Loading WARN telemetry...</Text>
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.alert}>
                <Text style={styles.alertTitle}>Live feed issue</Text>
                <Text style={styles.alertText}>{error}</Text>
              </View>
            ) : null}

            {activeScreen === 'overview' ? <OverviewScreen analytics={analytics} /> : null}
            {activeScreen === 'companies' ? <CompaniesScreen analytics={analytics} /> : null}
            {activeScreen === 'regions' ? <RegionsScreen analytics={analytics} /> : null}
            {activeScreen === 'notices' ? <NoticesScreen notices={analytics.recentNotices} /> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OverviewScreen({ analytics }: { analytics: Analytics }) {
  return (
    <View style={styles.screen}>
      <View style={styles.metricGrid}>
        <MetricCard label="Last 7 days" value={analytics.last7.notices.toLocaleString()} detail={`${analytics.last7.employees.toLocaleString()} workers`} accent={palette.red} />
        <MetricCard label="Last 30 days" value={analytics.last30.notices.toLocaleString()} detail={`${analytics.last30.employees.toLocaleString()} workers`} accent={palette.ink} />
        <MetricCard label="Companies" value={analytics.companyCount.toLocaleString()} detail="unique employers" accent={palette.blue} />
        <MetricCard label="Avg impact" value={analytics.averageImpact.toLocaleString()} detail="workers per notice" accent={palette.green} />
      </View>

      <Section eyebrow="Trend" title="Monthly workers affected">
        <TrendChart points={analytics.monthlySeries} />
      </Section>

      <Section eyebrow="Momentum" title="Top companies, last 30 days">
        <RankList rows={analytics.topCompanies30} emptyLabel="No WARN notices in the last 30 days." />
      </Section>
    </View>
  );
}

function CompaniesScreen({ analytics }: { analytics: Analytics }) {
  return (
    <View style={styles.screen}>
      <Section eyebrow="Hot list" title="Top companies, last 7 days">
        <RankList rows={analytics.topCompanies7} emptyLabel="No WARN notices in the last 7 days." />
      </Section>

      <Section eyebrow="Thirty-day view" title="Top companies, last 30 days">
        <RankList rows={analytics.topCompanies30} emptyLabel="No WARN notices in the last 30 days." />
      </Section>

      <Section eyebrow="All cached notices" title="Largest total impact">
        <RankList rows={analytics.topCompaniesAll} emptyLabel="No company telemetry available." />
      </Section>
    </View>
  );
}

function RegionsScreen({ analytics }: { analytics: Analytics }) {
  return (
    <View style={styles.screen}>
      <View style={styles.metricGrid}>
        <MetricCard label="States" value={analytics.stateCount.toLocaleString()} detail="with cached WARNs" accent={palette.red} />
        <MetricCard label="Industries" value={analytics.industryCount.toLocaleString()} detail="represented" accent={palette.ink} />
      </View>

      <Section eyebrow="Geography" title="State exposure">
        <BarList rows={analytics.topStates} />
      </Section>

      <Section eyebrow="Sectors" title="Industry stress">
        <BarList rows={analytics.topIndustries} />
      </Section>
    </View>
  );
}

function NoticesScreen({ notices }: { notices: WarnNotice[] }) {
  return (
    <View style={styles.screen}>
      <Section eyebrow="Company tape" title="Recent WARN notices">
        {notices.map((notice) => (
          <NoticeRow key={notice.id} notice={notice} />
        ))}
      </Section>
    </View>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Section({ children, eyebrow, title }: { children: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function MetricCard({ accent, detail, label, value }: { accent: string; detail: string; label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function TrendChart({ points }: { points: ChartPoint[] }) {
  const width = 320;
  const height = 156;
  const padding = 22;
  const max = Math.max(...points.map((point) => point.value), 1);
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const coords = points.map((point, index) => {
    const x = padding + index * step;
    const y = height - padding - (point.value / max) * (height - padding * 2);
    return { ...point, x, y };
  });
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const area = `${line} L ${coords.at(-1)?.x ?? padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <View style={styles.chartFrame}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 1, 2].map((tick) => (
          <Line
            key={tick}
            x1={padding}
            x2={width - padding}
            y1={padding + tick * 48}
            y2={padding + tick * 48}
            stroke={palette.faint}
            strokeWidth={1}
          />
        ))}
        <Path d={area} fill={palette.redSoft} />
        <Path d={line} fill="none" stroke={palette.red} strokeLinecap="round" strokeWidth={3} />
        {coords.map((point) => (
          <G key={point.label}>
            <Circle cx={point.x} cy={point.y} r={4} fill={palette.panel} stroke={palette.red} strokeWidth={2} />
            <SvgText x={point.x} y={height - 4} fill={palette.muted} fontSize={10} textAnchor="middle">
              {point.label}
            </SvgText>
          </G>
        ))}
      </Svg>
    </View>
  );
}

function RankList({ emptyLabel, rows }: { emptyLabel: string; rows: RankedRow[] }) {
  if (!rows.length) {
    return <Text style={styles.emptyText}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.rankList}>
      {rows.map((row, index) => (
        <CompanyRow key={`${row.label}-${index}`} index={index} row={row} />
      ))}
    </View>
  );
}

function CompanyRow({ index, row }: { index: number; row: RankedRow }) {
  return (
    <View style={styles.companyRow}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankBadgeText}>{index + 1}</Text>
      </View>
      <View style={styles.companyMain}>
        <Text style={styles.companyName} numberOfLines={1}>
          {row.label}
        </Text>
        <Text style={styles.companyMeta} numberOfLines={1}>
          {row.notices.toLocaleString()} notices{row.meta ? ` / ${row.meta}` : ''}
        </Text>
      </View>
      <View style={styles.companyImpact}>
        <Text style={styles.companyWorkers}>{row.value.toLocaleString()}</Text>
        <Text style={styles.companyWorkersLabel}>workers</Text>
      </View>
    </View>
  );
}

function BarList({ rows }: { rows: RankedRow[] }) {
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

function NoticeRow({ notice }: { notice: WarnNotice }) {
  return (
    <View style={styles.noticeRow}>
      <View style={styles.noticeDateBlock}>
        <Text style={styles.noticeMonth}>{formatMonth(notice.date)}</Text>
        <Text style={styles.noticeDay}>{formatDay(notice.date)}</Text>
      </View>
      <View style={styles.noticeMain}>
        <Text style={styles.noticeCompany} numberOfLines={1}>
          {notice.company}
        </Text>
        <Text style={styles.noticeMeta} numberOfLines={1}>
          {notice.city}, {notice.state} / {notice.industry}
        </Text>
      </View>
      <View style={styles.noticeImpact}>
        <Text style={styles.noticeEmployees}>{notice.employees.toLocaleString()}</Text>
        <Text style={styles.noticeEmployeesLabel}>workers</Text>
      </View>
    </View>
  );
}

type Analytics = ReturnType<typeof buildAnalytics>;

function buildAnalytics(notices: WarnNotice[]) {
  const sorted = [...notices].sort((a, b) => toTime(b.date) - toTime(a.date));
  const totalEmployees = notices.reduce((sum, notice) => sum + notice.employees, 0);
  const last7Notices = filterWithinDays(notices, 7);
  const last30Notices = filterWithinDays(notices, 30);
  const states = groupBy(notices, (notice) => notice.state || 'NA');
  const industries = groupBy(notices, (notice) => notice.industry || 'Unclassified');
  const companies = groupBy(notices, (notice) => notice.company || 'Unknown company');
  const months = groupBy(notices, (notice) => monthKey(notice.date));

  return {
    totalNotices: notices.length,
    totalEmployees,
    companyCount: Object.keys(companies).length,
    industryCount: Object.keys(industries).length,
    stateCount: Object.keys(states).length,
    averageImpact: notices.length ? Math.round(totalEmployees / notices.length) : 0,
    last7: summarize(last7Notices),
    last30: summarize(last30Notices),
    topCompanies7: rankGroups(groupBy(last7Notices, (notice) => notice.company)).slice(0, 8),
    topCompanies30: rankGroups(groupBy(last30Notices, (notice) => notice.company)).slice(0, 8),
    topCompaniesAll: rankGroups(companies).slice(0, 12),
    topStates: rankGroups(states).slice(0, 8),
    topIndustries: rankGroups(industries).slice(0, 8),
    monthlySeries: buildMonthlySeries(months),
    recentNotices: sorted.slice(0, 25),
  };
}

function summarize(records: WarnNotice[]) {
  return {
    notices: records.length,
    employees: records.reduce((sum, notice) => sum + notice.employees, 0),
  };
}

function rankGroups(groups: Record<string, WarnNotice[]>): RankedRow[] {
  return Object.entries(groups)
    .map(([label, group]) => ({
      label,
      value: group.reduce((sum, notice) => sum + notice.employees, 0),
      notices: group.length,
      meta: compactUnique(group.map((notice) => notice.state)).slice(0, 3).join(', '),
    }))
    .sort((a, b) => b.value - a.value);
}

function buildMonthlySeries(groups: Record<string, WarnNotice[]>): ChartPoint[] {
  const keys = Object.keys(groups).sort().slice(-6);
  const series = keys.map((key) => ({
    label: key.split('-')[1] ?? key,
    value: groups[key].reduce((sum, notice) => sum + notice.employees, 0),
  }));

  return series.length > 1 ? series : [{ label: 'now', value: series[0]?.value ?? 1 }, { label: 'next', value: series[0]?.value ?? 1 }];
}

function filterWithinDays(records: WarnNotice[], days: number) {
  const cutoff = Date.now() - days * DAY_MS;
  return records.filter((notice) => toTime(notice.date) >= cutoff);
}

function groupBy(records: WarnNotice[], getKey: (notice: WarnNotice) => string) {
  return records.reduce<Record<string, WarnNotice[]>>((groups, notice) => {
    const key = getKey(notice).trim() || 'Unknown';
    groups[key] = [...(groups[key] ?? []), notice];
    return groups;
  }, {});
}

function compactUnique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractRecords(json: unknown): RawWarnRecord[] {
  if (Array.isArray(json)) {
    return json as RawWarnRecord[];
  }

  if (json && typeof json === 'object') {
    const object = json as Record<string, unknown>;
    const candidateKeys = ['records', 'data', 'results', 'notices'];
    for (const key of candidateKeys) {
      if (Array.isArray(object[key])) {
        return object[key] as RawWarnRecord[];
      }
    }
  }

  return [];
}

function normalizeNotice(record: RawWarnRecord, index: number): WarnNotice | null {
  const company = text(record.company_name, record.company, record.employer, record.name);
  if (!company) {
    return null;
  }

  const date = text(record.notice_date, record.date, record.received_date, record.effective_date, record.layoff_date);
  const state = text(record.state, record.state_code, record.location_state).toUpperCase();

  return {
    id: text(record.id, record.record_id, record.notice_id) || `${company}-${date}-${index}`,
    company,
    city: text(record.city, record.location_city, record.worksite_city) || 'Unknown city',
    state: state || 'NA',
    industry: text(record.industry, record.naics_industry, record.sector) || 'Unclassified',
    date: date || new Date().toISOString(),
    employees: number(record.employees_affected, record.workers_affected, record.employees, record.total_layoffs, record.count),
    reason: text(record.reason, record.closure_type, record.notice_type, record.type) || 'WARN notice',
  };
}

function text(...values: unknown[]) {
  const value = values.find((item) => typeof item === 'string' || typeof item === 'number');
  return value === undefined || value === null ? '' : String(value).trim();
}

function number(...values: unknown[]) {
  const value = values.find((item) => Number.isFinite(Number(item)));
  return value === undefined || value === null ? 0 : Number(value);
}

function toTime(date: string) {
  const parsed = new Date(date).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function monthKey(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function isCacheExpired(savedAt: string) {
  const savedTime = new Date(savedAt).getTime();
  return Number.isNaN(savedTime) || Date.now() - savedTime >= CACHE_TTL_MS;
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

function formatMonth(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'NA' : new Intl.DateTimeFormat('en-US', { month: 'short' }).format(parsed);
}

function formatDay(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? '--' : new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(parsed);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected WARN Firehose error';
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: palette.page,
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 18,
    paddingBottom: 36,
  },
  header: {
    gap: 16,
    paddingTop: 12,
  },
  logoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  logoText: {
    color: palette.panel,
    fontSize: 24,
    fontWeight: '900',
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: palette.red,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.ink,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
    marginTop: 3,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 420,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    backgroundColor: palette.panel,
    borderColor: palette.faint,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 112,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  metaLabel: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  tabBar: {
    backgroundColor: palette.soft,
    borderColor: palette.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tabButtonActive: {
    backgroundColor: palette.panel,
  },
  tabText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  tabTextActive: {
    color: palette.ink,
  },
  screen: {
    gap: 16,
  },
  loadingPanel: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 28,
  },
  loadingText: {
    color: palette.muted,
    fontSize: 14,
  },
  alert: {
    backgroundColor: palette.redSoft,
    borderColor: '#ffd1c5',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  alertTitle: {
    color: palette.red,
    fontSize: 14,
    fontWeight: '900',
  },
  alertText: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    backgroundColor: palette.panel,
    borderColor: palette.faint,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 116,
    padding: 14,
    width: '48%',
  },
  metricAccent: {
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    width: 36,
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 6,
  },
  metricDetail: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  section: {
    backgroundColor: palette.panel,
    borderColor: palette.faint,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  sectionEyebrow: {
    color: palette.red,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  sectionBody: {
    marginTop: 14,
  },
  chartFrame: {
    marginTop: 2,
  },
  rankList: {
    gap: 0,
  },
  companyRow: {
    alignItems: 'center',
    borderBottomColor: palette.faint,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  rankBadge: {
    alignItems: 'center',
    backgroundColor: palette.soft,
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  rankBadgeText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  companyMain: {
    flex: 1,
  },
  companyName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  companyMeta: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  companyImpact: {
    alignItems: 'flex-end',
  },
  companyWorkers: {
    color: palette.red,
    fontSize: 16,
    fontWeight: '900',
  },
  companyWorkersLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  barList: {
    gap: 14,
  },
  barRow: {
    gap: 8,
  },
  barLabelRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  barLabel: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  barValue: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  barTrack: {
    backgroundColor: palette.soft,
    borderRadius: 8,
    height: 8,
    overflow: 'hidden',
  },
  barFill: {
    borderRadius: 8,
    height: 8,
  },
  noticeRow: {
    alignItems: 'center',
    borderBottomColor: palette.faint,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 13,
  },
  noticeDateBlock: {
    alignItems: 'center',
    backgroundColor: palette.soft,
    borderRadius: 8,
    minHeight: 46,
    justifyContent: 'center',
    width: 48,
  },
  noticeMonth: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  noticeDay: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  noticeMain: {
    flex: 1,
  },
  noticeCompany: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  noticeMeta: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  noticeImpact: {
    alignItems: 'flex-end',
  },
  noticeEmployees: {
    color: palette.red,
    fontSize: 16,
    fontWeight: '900',
  },
  noticeEmployeesLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
});
