import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
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
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

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

const WARN_API_KEY = process.env.EXPO_PUBLIC_WARN_FIREHOSE_API_KEY ?? '';
const WARN_ENDPOINT = 'https://warnfirehose.com/api/records?limit=100';
const CACHE_KEY = 'warnfirehose.warn_notices.v1';
const FALLBACK_ACCENT = '#ffcf5a';

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
  const [notices, setNotices] = useState<WarnNotice[]>([]);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCachedOrFetch();
  }, []);

  const analytics = useMemo(() => buildAnalytics(notices), [notices]);

  async function loadCachedOrFetch() {
    setLoading(true);
    setError(null);

    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const payload = JSON.parse(cached) as CachePayload;
        setNotices(payload.notices);
        setCachedAt(payload.savedAt);
        return;
      }

      await fetchAndCache();
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      setNotices(sampleNotices);
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

  async function refreshCache() {
    setRefreshing(true);
    setError(null);

    try {
      await AsyncStorage.removeItem(CACHE_KEY);
      await fetchAndCache();
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={['#101820', '#17272a', '#263127']} style={styles.shell}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>K</Text>
              </View>
              <View>
                <Text style={styles.kicker}>Klevel.fyi labor telemetry</Text>
                <Text style={styles.title}>Immigration and layoff signals</Text>
              </View>
            </View>

            <Text style={styles.heroCopy}>
              WARN-only feed from Warn Firehose, cached locally after the first successful pull.
            </Text>

            <View style={styles.syncRow}>
              <View style={styles.syncPill}>
                <Text style={styles.syncLabel}>Source</Text>
                <Text style={styles.syncValue}>/api/records</Text>
              </View>
              <View style={styles.syncPill}>
                <Text style={styles.syncLabel}>Cache</Text>
                <Text style={styles.syncValue}>{cachedAt ? formatDateTime(cachedAt) : 'warming'}</Text>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator color={FALLBACK_ACCENT} />
              <Text style={styles.loadingText}>Pulling WARN notices once, then moving to local cache...</Text>
            </View>
          ) : (
            <>
              {error ? (
                <View style={styles.alert}>
                  <Text style={styles.alertTitle}>Live feed issue</Text>
                  <Text style={styles.alertText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.metricGrid}>
                <MetricCard label="WARN notices" value={analytics.totalNotices.toLocaleString()} tone="gold" />
                <MetricCard label="Workers affected" value={analytics.totalEmployees.toLocaleString()} tone="coral" />
                <MetricCard label="States touched" value={analytics.stateCount.toLocaleString()} tone="green" />
                <MetricCard label="Avg impact" value={analytics.averageImpact.toLocaleString()} tone="blue" />
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionEyebrow}>Signal density</Text>
                    <Text style={styles.sectionTitle}>Layoff pulse</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={refreshing}
                    onPress={refreshCache}
                    style={({ pressed }) => [styles.refreshButton, pressed && styles.pressedButton]}
                  >
                    <Text style={styles.refreshButtonText}>{refreshing ? 'Syncing' : 'Refresh'}</Text>
                  </Pressable>
                </View>
                <TrendChart points={analytics.monthlySeries} />
              </View>

              <View style={styles.splitGrid}>
                <View style={styles.sectionHalf}>
                  <Text style={styles.sectionEyebrow}>Geography</Text>
                  <Text style={styles.sectionTitle}>State exposure</Text>
                  <BarList rows={analytics.topStates} />
                </View>

                <View style={styles.sectionHalf}>
                  <Text style={styles.sectionEyebrow}>Industries</Text>
                  <Text style={styles.sectionTitle}>Sector stress</Text>
                  <DonutChart rows={analytics.topIndustries} total={analytics.totalEmployees} />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>Company tape</Text>
                <Text style={styles.sectionTitle}>Recent WARN notices</Text>
                {notices.slice(0, 10).map((notice) => (
                  <NoticeRow key={notice.id} notice={notice} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'gold' | 'coral' | 'green' | 'blue' }) {
  return (
    <View style={[styles.metricCard, styles[`metric_${tone}`]]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
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
            stroke="rgba(255,255,255,0.11)"
            strokeWidth={1}
          />
        ))}
        <Path d={area} fill="rgba(255, 207, 90, 0.16)" />
        <Path d={line} fill="none" stroke={FALLBACK_ACCENT} strokeLinecap="round" strokeWidth={4} />
        {coords.map((point) => (
          <G key={point.label}>
            <Circle cx={point.x} cy={point.y} r={5} fill="#101820" stroke={FALLBACK_ACCENT} strokeWidth={3} />
            <SvgText x={point.x} y={height - 4} fill="rgba(255,255,255,0.58)" fontSize={10} textAnchor="middle">
              {point.label}
            </SvgText>
          </G>
        ))}
      </Svg>
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
            <View style={[styles.barFill, { width: `${Math.max((row.value / max) * 100, 6)}%`, opacity: 1 - index * 0.09 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function DonutChart({ rows, total }: { rows: RankedRow[]; total: number }) {
  const size = 180;
  const strokeWidth = 22;
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const palette = ['#ffcf5a', '#ff7a61', '#79d99b', '#72b7ff', '#d5e7a2'];

  return (
    <View style={styles.donutWrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} fill="none" />
        {rows.map((row, index) => {
          const segment = total > 0 ? (row.value / total) * circumference : 0;
          const dashOffset = -offset;
          offset += segment;
          return (
            <Circle
              key={row.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={palette[index % palette.length]}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${segment} ${circumference - segment}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
            />
          );
        })}
        <SvgText x={size / 2} y={size / 2 - 2} fill="#ffffff" fontSize={28} fontWeight="700" textAnchor="middle">
          {rows.length}
        </SvgText>
        <SvgText x={size / 2} y={size / 2 + 22} fill="rgba(255,255,255,0.62)" fontSize={11} textAnchor="middle">
          sectors
        </SvgText>
      </Svg>
      <View style={styles.legend}>
        {rows.map((row, index) => (
          <View key={row.label} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: palette[index % palette.length] }]} />
            <Text style={styles.legendText} numberOfLines={1}>
              {row.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function NoticeRow({ notice }: { notice: WarnNotice }) {
  return (
    <View style={styles.noticeRow}>
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
        <Text style={styles.noticeDate}>{formatShortDate(notice.date)}</Text>
      </View>
    </View>
  );
}

type ChartPoint = {
  label: string;
  value: number;
};

type RankedRow = {
  label: string;
  value: number;
};

function buildAnalytics(notices: WarnNotice[]) {
  const totalEmployees = notices.reduce((sum, notice) => sum + notice.employees, 0);
  const states = groupBy(notices, (notice) => notice.state || 'NA');
  const industries = groupBy(notices, (notice) => notice.industry || 'Unclassified');
  const months = groupBy(notices, (notice) => monthKey(notice.date));

  return {
    totalNotices: notices.length,
    totalEmployees,
    stateCount: Object.keys(states).length,
    averageImpact: notices.length ? Math.round(totalEmployees / notices.length) : 0,
    topStates: rankGroups(states).slice(0, 5),
    topIndustries: rankGroups(industries).slice(0, 5),
    monthlySeries: buildMonthlySeries(months),
  };
}

function rankGroups(groups: Record<string, WarnNotice[]>): RankedRow[] {
  return Object.entries(groups)
    .map(([label, group]) => ({
      label,
      value: group.reduce((sum, notice) => sum + notice.employees, 0),
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

function groupBy(records: WarnNotice[], getKey: (notice: WarnNotice) => string) {
  return records.reduce<Record<string, WarnNotice[]>>((groups, notice) => {
    const key = getKey(notice).trim() || 'Unknown';
    groups[key] = [...(groups[key] ?? []), notice];
    return groups;
  }, {});
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

function monthKey(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

function formatShortDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return 'date n/a';
  }

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected WARN Firehose error';
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    gap: 18,
    padding: 18,
    paddingBottom: 36,
  },
  hero: {
    gap: 18,
    minHeight: 248,
    justifyContent: 'flex-end',
    paddingTop: 24,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: FALLBACK_ACCENT,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  brandMarkText: {
    color: '#101820',
    fontSize: 26,
    fontWeight: '900',
  },
  kicker: {
    color: '#a9d8c6',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
    maxWidth: 320,
  },
  heroCopy: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 340,
  },
  syncRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  syncPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 142,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  syncLabel: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  syncValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  loadingPanel: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    gap: 12,
    padding: 24,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    textAlign: 'center',
  },
  alert: {
    backgroundColor: 'rgba(255,122,97,0.14)',
    borderColor: 'rgba(255,122,97,0.36)',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  alertTitle: {
    color: '#ffb4a6',
    fontSize: 14,
    fontWeight: '800',
  },
  alertText: {
    color: 'rgba(255,255,255,0.76)',
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
    borderRadius: 8,
    minHeight: 106,
    padding: 14,
    width: '48%',
  },
  metric_gold: {
    backgroundColor: 'rgba(255,207,90,0.16)',
  },
  metric_coral: {
    backgroundColor: 'rgba(255,122,97,0.16)',
  },
  metric_green: {
    backgroundColor: 'rgba(121,217,155,0.15)',
  },
  metric_blue: {
    backgroundColor: 'rgba(114,183,255,0.15)',
  },
  metricValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderColor: 'rgba(255,255,255,0.11)',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  sectionHalf: {
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderColor: 'rgba(255,255,255,0.11)',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    color: '#a9d8c6',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 3,
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    minWidth: 86,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pressedButton: {
    opacity: 0.76,
  },
  refreshButtonText: {
    color: '#101820',
    fontSize: 13,
    fontWeight: '900',
  },
  chartFrame: {
    marginTop: 14,
  },
  splitGrid: {
    gap: 18,
  },
  barList: {
    gap: 14,
    marginTop: 4,
  },
  barRow: {
    gap: 8,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barLabel: {
    color: '#ffffff',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  barValue: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 13,
    fontWeight: '700',
  },
  barTrack: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    height: 8,
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: FALLBACK_ACCENT,
    borderRadius: 8,
    height: 8,
  },
  donutWrap: {
    alignItems: 'center',
    gap: 6,
  },
  legend: {
    alignSelf: 'stretch',
    gap: 8,
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  legendDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  legendText: {
    color: 'rgba(255,255,255,0.74)',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  noticeRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.09)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
  },
  noticeMain: {
    flex: 1,
  },
  noticeCompany: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  noticeMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 4,
  },
  noticeImpact: {
    alignItems: 'flex-end',
  },
  noticeEmployees: {
    color: FALLBACK_ACCENT,
    fontSize: 16,
    fontWeight: '900',
  },
  noticeDate: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 12,
    marginTop: 4,
  },
});
