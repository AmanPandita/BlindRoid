import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './utils/supabase';
import { createBottomTabNavigator, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

declare const process: {
  env: {
    EXPO_PUBLIC_WARN_FIREHOSE_API_KEY?: string;
    EXPO_PUBLIC_REDDIT_CLIENT_ID?: string;
    EXPO_PUBLIC_REDDIT_CLIENT_SECRET?: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_KEY?: string;
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
  ticker?: string;
};

type CachePayload = {
  savedAt: string;
  notices: WarnNotice[];
};

type RootTabParamList = {
  Overview: undefined;
  Companies: undefined;
  Regions: undefined;
  Notices: undefined;
  Reddit: undefined;
};

type RankedRow = {
  label: string;
  value: number;
  notices: number;
  meta?: string;
  ticker?: string;
};
type CompanyRangeKey = '7d' | '30d' | 'all';
type NoticeRangeKey = '7d' | '30d' | 'all';
type StockQuote = {
  currency: string;
  marketState: string;
  price: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: number;
  symbol: string;
};

type RedditPost = {
  id: string;
  title: string;
  author: string;
  created: number;
  url: string;
  permalink: string;
  selftext: string;
  subreddit: string;
  score: number;
  num_comments: number;
  company?: string;
};

const CACHE_KEY = 'warnfirehose.warn_notices.v1';
const REDDIT_CACHE_KEY = 'warnfirehose.reddit_posts.v1';
const REDDIT_LAST_FETCH_KEY = 'warnfirehose.reddit_last_fetch.v1';
const REDDIT_REFRESH_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes cooldown between refreshes
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

const BottomTab = createBottomTabNavigator<RootTabParamList>();
const TopTab = createMaterialTopTabNavigator<RootTabParamList>();
const Tab = Platform.OS === 'web' ? TopTab : BottomTab;
const navigationRef = createNavigationContainerRef<RootTabParamList>();

const companyRanges: { key: CompanyRangeKey; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: 'all', label: 'All' },
];

const noticeRanges: { key: NoticeRangeKey; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: 'all', label: 'All' },
];

const knownCompanyDomains: Record<string, string> = {
  '3m': '3m.com',
  accenture: 'accenture.com',
  adobe: 'adobe.com',
  amazon: 'amazon.com',
  apple: 'apple.com',
  att: 'att.com',
  boeing: 'boeing.com',
  cisco: 'cisco.com',
  dell: 'dell.com',
  disney: 'disney.com',
  doordash: 'doordash.com',
  dropbox: 'dropbox.com',
  expedia: 'expedia.com',
  fedex: 'fedex.com',
  google: 'google.com',
  hp: 'hp.com',
  ibm: 'ibm.com',
  intel: 'intel.com',
  intuit: 'intuit.com',
  lyft: 'lyft.com',
  meta: 'meta.com',
  microsoft: 'microsoft.com',
  netflix: 'netflix.com',
  nike: 'nike.com',
  oracle: 'oracle.com',
  paypal: 'paypal.com',
  salesforce: 'salesforce.com',
  shopify: 'shopify.com',
  spotify: 'spotify.com',
  stripe: 'stripe.com',
  target: 'target.com',
  tesla: 'tesla.com',
  twilio: 'twilio.com',
  uber: 'uber.com',
  ups: 'ups.com',
  verizon: 'verizon.com',
  visa: 'visa.com',
  walmart: 'walmart.com',
  wayfair: 'wayfair.com',
  zoom: 'zoom.us',
};

const knownCompanyTickers: Record<string, string> = {
  '3m': 'MMM',
  accenture: 'ACN',
  adobe: 'ADBE',
  amazon: 'AMZN',
  apple: 'AAPL',
  att: 'T',
  boeing: 'BA',
  cisco: 'CSCO',
  dell: 'DELL',
  disney: 'DIS',
  doordash: 'DASH',
  dropbox: 'DBX',
  expedia: 'EXPE',
  fedex: 'FDX',
  google: 'GOOGL',
  hp: 'HPQ',
  ibm: 'IBM',
  intel: 'INTC',
  intuit: 'INTU',
  lyft: 'LYFT',
  meta: 'META',
  microsoft: 'MSFT',
  netflix: 'NFLX',
  nike: 'NKE',
  oracle: 'ORCL',
  paypal: 'PYPL',
  salesforce: 'CRM',
  shopify: 'SHOP',
  spotify: 'SPOT',
  stripe: 'STRIP',
  target: 'TGT',
  tesla: 'TSLA',
  twilio: 'TWLO',
  uber: 'UBER',
  ups: 'UPS',
  verizon: 'VZ',
  visa: 'V',
  walmart: 'WMT',
  wayfair: 'W',
  zoom: 'ZM',
};

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
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalViewCount, setTotalViewCount] = useState(0);

  useEffect(() => {
    loadCachedThenRefresh();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Fetch current total count
    supabase
      .from('app_opens')
      .select('*', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (error) console.error('[app_opens] select error:', error.message);
        if (count !== null) setTotalViewCount(count);
      });

    // Increment counter by inserting a new row
    supabase.from('app_opens').insert({ opened_at: new Date().toISOString() }).then(({ error }) => {
      if (error) console.error('[app_opens] insert error:', error.message);
    });

    // Subscribe to real-time inserts to update the count dynamically
    const channel = supabase
      .channel('app_opens_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_opens' }, () => {
        setTotalViewCount((prev) => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const analytics = useMemo(() => buildAnalytics(notices), [notices]);

  async function loadCachedThenRefresh() {
    setLoading(true);
    setError(null);

    // Show cached data immediately while the DB fetch runs
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const payload = JSON.parse(cached) as CachePayload;
        if (payload.notices.length) {
          setNotices(payload.notices);
          setLastUpdatedAt(payload.savedAt);
          setLoading(false); // show stale data right away
        }
      }
    } catch {
      // ignore cache read errors
    }

    // Always fetch fresh from Supabase — DB is always up to date via the sync script
    try {
      await fetchAndCache();
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      // If we have no data at all yet, fall back to sample notices
      setNotices((current) => (current.length ? current : sampleNotices));
    } finally {
      setLoading(false);
    }
  }

  async function fetchAndCache() {
    const allRecords: WarnNotice[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error: queryError } = await supabase
        .from('warn_notices')
        .select('*')
        .order('date', { ascending: false })
        .range(from, from + pageSize - 1);

      if (queryError) throw new Error(queryError.message);
      if (!data || data.length === 0) break;

      allRecords.push(...(data as WarnNotice[]));
      if (data.length < pageSize) break;
      from += pageSize;
    }

    if (!allRecords.length) {
      throw new Error('No WARN notices found in database. Run the sync script to populate data.');
    }

    const savedAt = new Date().toISOString();
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt, notices: allRecords }));
    setNotices(allRecords);
    setLastUpdatedAt(savedAt);
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="dark" />
        <AppTabs
          analytics={analytics}
          error={error}
          lastUpdatedAt={lastUpdatedAt}
          totalViewCount={totalViewCount}
          loading={loading}
          notices={notices}
          totalCount={notices.length}
        />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function AppTabs({
  analytics,
  error,
  lastUpdatedAt,
  totalViewCount,
  loading,
  notices,
  totalCount,
}: {
  analytics: Analytics;
  error: string | null;
  lastUpdatedAt: string | null;
  totalViewCount: number;
  loading: boolean;
  notices: WarnNotice[];
  totalCount: number;
}) {
  const insets = useSafeAreaInsets();

  const isWeb = Platform.OS === 'web';

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: { name: keyof RootTabParamList } }) => ({
        headerShown: false,
        sceneStyle: {
          backgroundColor: palette.page,
        },
        tabBarActiveTintColor: palette.red,
        tabBarInactiveTintColor: palette.muted,
        ...(isWeb ? {
          tabBarLabelStyle: styles.navigatorLabel,
          tabBarStyle: styles.topNavigatorBar,
          tabBarIndicatorStyle: { backgroundColor: palette.red },
        } : {
          tabBarIconStyle: styles.navigatorIconSlot,
          tabBarItemStyle: styles.navigatorItem,
          tabBarLabelStyle: styles.navigatorLabel,
          tabBarStyle: [
            styles.navigatorBar,
            {
              height: 48 + insets.bottom,
              paddingBottom: insets.bottom,
            },
          ],
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean; size: number }) => <TabGlyph color={color} focused={focused} name={route.name} />,
        }),
      })}
    >
      <Tab.Screen name="Overview">
        {() => <OverviewScreenWrapper analytics={analytics} error={error} lastUpdatedAt={lastUpdatedAt} totalViewCount={totalViewCount} loading={loading} notices={notices} totalCount={totalCount} />}
      </Tab.Screen>
      <Tab.Screen name="Companies">
        {() => <CompaniesScreenWrapper analytics={analytics} error={error} loading={loading} />}
      </Tab.Screen>
      <Tab.Screen name="Regions">
        {() => <RegionsScreenWrapper analytics={analytics} error={error} loading={loading} />}
      </Tab.Screen>
      <Tab.Screen name="Notices">
        {() => <NoticesScreenWrapper error={error} loading={loading} notices={notices} />}
      </Tab.Screen>
      <Tab.Screen name="Reddit">
        {() => <RedditScreenWrapper />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function ScreenShell({ children, error, loading, onRefresh, refreshing, searchValue, onSearchChange, searchPlaceholder, showRefreshButton }: { children: ReactNode; error: string | null; loading: boolean; onRefresh?: () => void; refreshing?: boolean; searchValue?: string; onSearchChange?: (value: string) => void; searchPlaceholder?: string; showRefreshButton?: boolean }) {
  const tabBarHeight = Platform.OS === 'web' ? 0 : useBottomTabBarHeight();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 18 }]}
        refreshControl={
          onRefresh && Platform.OS !== 'web' ? (
            <RefreshControl
              refreshing={refreshing || false}
              onRefresh={onRefresh}
              tintColor={palette.red}
              colors={[palette.red]}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        <Header searchValue={searchValue} onSearchChange={onSearchChange} searchPlaceholder={searchPlaceholder} showRefreshButton={showRefreshButton} onRefresh={onRefresh} refreshing={refreshing} />
        {loading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={palette.red} size="large" />
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.alert}>
                <Text style={styles.alertTitle}>Live feed issue</Text>
                <Text style={styles.alertText}>{error}</Text>
              </View>
            ) : null}
            {children}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ searchValue, onSearchChange, searchPlaceholder, showRefreshButton, onRefresh, refreshing }: { searchValue?: string; onSearchChange?: (value: string) => void; searchPlaceholder?: string; showRefreshButton?: boolean; onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <View style={styles.header}>
      <View style={styles.logoRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>b{'\n'}WARN{'\n'}ed</Text>
        </View>
        {onSearchChange && (
          <View style={styles.searchInputContainer}>
            <TextInput
              autoCapitalize="none"
              clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder || "Search"}
              placeholderTextColor={palette.muted}
              style={styles.headerSearchInput}
              value={searchValue}
            />
            {Platform.OS === 'android' && searchValue && searchValue.length > 0 && (
              <Pressable
                onPress={() => onSearchChange('')}
                style={styles.clearButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.clearButtonText}>✕</Text>
              </Pressable>
            )}
          </View>
        )}
        {showRefreshButton && Platform.OS === 'web' && onRefresh && (
          <Pressable
            onPress={onRefresh}
            style={[styles.refreshButton, refreshing && styles.refreshButtonDisabled]}
            disabled={refreshing}
          >
            <Text style={styles.refreshButtonText}>{refreshing ? '⟳ Refreshing...' : '⟳ Refresh'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function TabGlyph({ color, focused, name }: { color: string; focused: boolean; name: keyof RootTabParamList }) {
  return (
    <View style={[styles.tabGlyph, focused && styles.tabGlyphActive]}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        {tabIcon(name, color)}
      </Svg>
    </View>
  );
}

function tabIcon(name: keyof RootTabParamList, color: string) {
  switch (name) {
    case 'Overview':
      return (
        <>
          <Path d="M4 18V9" stroke={color} strokeLinecap="round" strokeWidth={2.3} />
          <Path d="M10 18V5" stroke={color} strokeLinecap="round" strokeWidth={2.3} />
          <Path d="M16 18v-7" stroke={color} strokeLinecap="round" strokeWidth={2.3} />
          <Path d="M22 18v-4" stroke={color} strokeLinecap="round" strokeWidth={2.3} />
        </>
      );
    case 'Companies':
      return (
        <>
          <Path d="M5 20V6.5L12 3l7 3.5V20" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={2.1} />
          <Path d="M9 20v-5h6v5" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={2.1} />
          <Path d="M9 9h.01M12 9h.01M15 9h.01" stroke={color} strokeLinecap="round" strokeWidth={3} />
        </>
      );
    case 'Regions':
      return (
        <>
          <Circle cx={12} cy={10} r={3} fill="none" stroke={color} strokeWidth={2.1} />
          <Path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={2.1} />
        </>
      );
    case 'Notices':
      return (
        <>
          <Path d="M7 4h8l3 3v13H7z" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={2.1} />
          <Path d="M14 4v4h4M10 12h5M10 16h5" stroke={color} strokeLinecap="round" strokeWidth={2.1} />
        </>
      );
    case 'Reddit':
      return (
        <>
          <Circle cx={12} cy={12} r={10} fill="none" stroke={color} strokeWidth={2.1} />
          <Circle cx={9} cy={10} r={1.5} fill={color} />
          <Circle cx={15} cy={10} r={1.5} fill={color} />
          <Path d="M8 15c0 0 1.5 2 4 2s4-2 4-2" fill="none" stroke={color} strokeLinecap="round" strokeWidth={2.1} />
        </>
      );
  }
}

function OverviewScreenWrapper({ analytics, error, lastUpdatedAt, totalViewCount, loading, notices, totalCount }: { analytics: Analytics; error: string | null; lastUpdatedAt: string | null; totalViewCount: number; loading: boolean; notices: WarnNotice[]; totalCount: number }) {
  const [companyQuery, setCompanyQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [logoRefreshKey, setLogoRefreshKey] = useState(0);
  const [localAnalytics, setLocalAnalytics] = useState(analytics);

  async function handleRefresh() {
    setRefreshing(true);
    // Recalculate analytics from current notices
    setLocalAnalytics(buildAnalytics(notices));
    // Increment logo refresh key to force logo re-fetching
    setLogoRefreshKey((current) => current + 1);
    // Simulate a brief refresh action
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  }

  // Update local analytics when parent analytics changes
  useEffect(() => {
    setLocalAnalytics(analytics);
  }, [analytics]);

  return (
    <ScreenShell loading={loading} error={error} onRefresh={handleRefresh} refreshing={refreshing} searchValue={companyQuery} onSearchChange={setCompanyQuery} searchPlaceholder="Search companies">
      <OverviewScreen
        analytics={localAnalytics}
        companyQuery={companyQuery}
        lastUpdatedAt={lastUpdatedAt}
        totalViewCount={totalViewCount}
        logoRefreshKey={logoRefreshKey}
        notices={notices}
        totalCount={totalCount}
      />
    </ScreenShell>
  );
}

function OverviewScreen({ analytics, companyQuery, lastUpdatedAt, totalViewCount, logoRefreshKey, notices, totalCount }: { analytics: Analytics; companyQuery: string; lastUpdatedAt: string | null; totalViewCount: number; logoRefreshKey: number; notices: WarnNotice[]; totalCount: number }) {
  const [range, setRange] = useState<CompanyRangeKey>('30d');
  const isSearching = companyQuery.trim().length > 0;

  // When searching, group and rank all notices that match the query
  const topCompanies = isSearching
    ? (() => {
        const companies = groupBy(notices, (notice) => notice.company || 'Unknown company');
        const allRanked = rankGroups(companies);
        return filterRankedRows(allRanked, companyQuery).slice(0, 5);
      })()
    : getCompanyRowsForRange(analytics, range).slice(0, 5);

  const topRegions = getRegionRowsForRange(analytics, range).slice(0, 5);
  const topIndustries = getIndustryRowsForRange(analytics, range).slice(0, 5);

  // Check if searched company is in top 5
  const hasSearchedCompanyInTop5 = isSearching && topCompanies.length > 0;
  const momentumTitle = isSearching && !hasSearchedCompanyInTop5 ? "All Companies" : getMomentumTitle(range);
  const regionsTitle = getRegionsTitle(range);
  const industriesTitle = getIndustriesTitle(range);

  return (
    <View style={styles.screen}>
      {!isSearching && (
        <SegmentedControl options={companyRanges} selected={range} onSelect={setRange} />
      )}

      <Section eyebrow="Momentum" title={momentumTitle}>
        <RankList rows={topCompanies} emptyLabel={isSearching ? "No matching companies found." : `No matching companies in the selected period.`} logoRefreshKey={logoRefreshKey} showStock />
      </Section>

      {!isSearching && (
        <>
          {Platform.OS === 'web' ? (
            <View style={styles.horizontalSectionsContainerWeb}>
              <View style={[styles.horizontalSection, styles.horizontalSectionWeb]}>
                <Text style={styles.horizontalSectionEyebrow}>Geography</Text>
                <Text style={styles.horizontalSectionTitle}>{regionsTitle}</Text>
                <View style={styles.horizontalSectionBody}>
                  <BarList rows={topRegions} />
                </View>
              </View>

              <View style={[styles.horizontalSection, styles.horizontalSectionWeb]}>
                <Text style={styles.horizontalSectionEyebrow}>Sectors</Text>
                <Text style={styles.horizontalSectionTitle}>{industriesTitle}</Text>
                <View style={styles.horizontalSectionBody}>
                  <BarList rows={topIndustries} />
                </View>
              </View>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalSectionsContainer}
            >
              <View style={styles.horizontalSection}>
                <Text style={styles.horizontalSectionEyebrow}>Geography</Text>
                <Text style={styles.horizontalSectionTitle}>{regionsTitle}</Text>
                <View style={styles.horizontalSectionBody}>
                  <BarList rows={topRegions} />
                </View>
              </View>

              <View style={styles.horizontalSection}>
                <Text style={styles.horizontalSectionEyebrow}>Sectors</Text>
                <Text style={styles.horizontalSectionTitle}>{industriesTitle}</Text>
                <View style={styles.horizontalSectionBody}>
                  <BarList rows={topIndustries} />
                </View>
              </View>
            </ScrollView>
          )}

          <View style={styles.metaRow}>
            <MetaPill label="Last updated" value={lastUpdatedAt ? formatUpdateTime(lastUpdatedAt) : 'Pending'} />
            {Platform.OS === 'web' && totalViewCount > 0 && (
              <MetaPill label="Total viewers" value={totalViewCount.toLocaleString()} />
            )}
          </View>
        </>
      )}
    </View>
  );
}

function CompaniesScreenWrapper({ analytics, error, loading }: { analytics: Analytics; error: string | null; loading: boolean }) {
  const [companyQuery, setCompanyQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [logoRefreshKey, setLogoRefreshKey] = useState(0);
  const [localAnalytics, setLocalAnalytics] = useState(analytics);

  async function handleRefresh() {
    setRefreshing(true);
    // Recalculate analytics - force re-render
    setLocalAnalytics({ ...analytics });
    // Increment logo refresh key to force logo re-fetching
    setLogoRefreshKey((current) => current + 1);
    // Simulate a brief refresh action
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  }

  // Update local analytics when parent analytics changes
  useEffect(() => {
    setLocalAnalytics(analytics);
  }, [analytics]);

  return (
    <ScreenShell loading={loading} error={error} onRefresh={handleRefresh} refreshing={refreshing} searchValue={companyQuery} onSearchChange={setCompanyQuery} searchPlaceholder="Search companies">
      <CompaniesScreen analytics={localAnalytics} companyQuery={companyQuery} logoRefreshKey={logoRefreshKey} />
    </ScreenShell>
  );
}

function CompaniesScreen({ analytics, companyQuery, logoRefreshKey }: { analytics: Analytics; companyQuery: string; logoRefreshKey: number }) {
  const [range, setRange] = useState<CompanyRangeKey>('30d');
  const rows = filterRankedRows(getCompanyRowsForRange(analytics, range), companyQuery);

  return (
    <View style={styles.screen}>
      <SegmentedControl options={companyRanges} selected={range} onSelect={setRange} />

      <Section eyebrow="Companies" title={companyRangeTitle(range)}>
        <RankList rows={rows} emptyLabel="No matching company telemetry available." logoRefreshKey={logoRefreshKey} showStock />
      </Section>
    </View>
  );
}

function RegionsScreenWrapper({ analytics, error, loading }: { analytics: Analytics; error: string | null; loading: boolean }) {
  const [regionQuery, setRegionQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [localAnalytics, setLocalAnalytics] = useState(analytics);

  async function handleRefresh() {
    setRefreshing(true);
    // Recalculate analytics - force re-render
    setLocalAnalytics({ ...analytics });
    // Simulate a brief refresh action
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  }

  // Update local analytics when parent analytics changes
  useEffect(() => {
    setLocalAnalytics(analytics);
  }, [analytics]);

  return (
    <ScreenShell loading={loading} error={error} onRefresh={handleRefresh} refreshing={refreshing} searchValue={regionQuery} onSearchChange={setRegionQuery} searchPlaceholder="Search states or industries">
      <RegionsScreen analytics={localAnalytics} regionQuery={regionQuery} />
    </ScreenShell>
  );
}

function RegionsScreen({ analytics, regionQuery }: { analytics: Analytics; regionQuery: string }) {
  const [range, setRange] = useState<CompanyRangeKey>('30d');
  const stateRows = filterRankedRows(getRegionRowsForRange(analytics, range), regionQuery);
  const industryRows = filterRankedRows(getIndustryRowsForRange(analytics, range), regionQuery);

  const stateTitle = range === '7d' ? 'State exposure, last 7 days' : range === '30d' ? 'State exposure, last 30 days' : 'State exposure, all time';
  const industryTitle = range === '7d' ? 'Industry stress, last 7 days' : range === '30d' ? 'Industry stress, last 30 days' : 'Industry stress, all time';

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

function NoticesScreenWrapper({ error, loading, notices }: { error: string | null; loading: boolean; notices: WarnNotice[] }) {
  const [noticeQuery, setNoticeQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [logoRefreshKey, setLogoRefreshKey] = useState(0);

  async function handleRefresh() {
    setRefreshing(true);
    // Increment logo refresh key to force logo re-fetching
    setLogoRefreshKey((current) => current + 1);
    // Simulate a brief refresh action
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  }

  return (
    <ScreenShell loading={loading} error={error} onRefresh={handleRefresh} refreshing={refreshing} searchValue={noticeQuery} onSearchChange={setNoticeQuery} searchPlaceholder="Search notices">
      <NoticesScreen logoRefreshKey={logoRefreshKey} notices={notices} noticeQuery={noticeQuery} />
    </ScreenShell>
  );
}

function NoticesScreen({ logoRefreshKey, notices, noticeQuery }: { logoRefreshKey: number; notices: WarnNotice[]; noticeQuery: string }) {
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
              logoRefreshKey={logoRefreshKey}
              notice={notice}
              isExpanded={expandedNotice === notice.id}
              onToggle={() => setExpandedNotice(expandedNotice === notice.id ? null : notice.id)}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>No matching WARN notices.</Text>
        )}
      </Section>
    </View>
  );
}

function RedditScreenWrapper() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCachedOrFetchReddit();
  }, []);

  async function loadCachedOrFetchReddit() {
    setLoading(true);
    setError(null);

    try {
      // Reddit API has CORS restrictions on web
      if (Platform.OS === 'web') {
        setError('Reddit integration is only available on the mobile app for now. Stay tuned for updates on this feature in the future!.');
        setLoading(false);
        return;
      }

      // Try to load from cache first
      const cached = await AsyncStorage.getItem(REDDIT_CACHE_KEY);
      if (cached) {
        const cachedPosts = JSON.parse(cached) as RedditPost[];
        setPosts(cachedPosts);
        return;
      }

      // No cache, fetch from API
      await fetchRedditPosts();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function fetchRedditPosts() {
    try {
      // Target specific subreddits with all relevant keywords
      // Reddit public API max limit is 100 per request, but we'll use smaller batches for reliability
      const subreddits = ['layoffs', 'cscareerquestions', 'h1b', 'immigration', 'jobs', 'tech'];
      const searchQuery = 'WARN OR "WARN notice" OR layoff OR layoffs OR "laid off" OR severance';

      const searches: Array<{ subreddit: string; query: string; limit: number }> = subreddits.map(sub => ({
        subreddit: sub,
        query: searchQuery,
        limit: 100, // Max out the Reddit API limit per request
      }));

      const allPosts: RedditPost[] = [];
      const keywords = ['warn', 'warn notice', 'layoff', 'layoffs', 'laid off', 'tech layoff', 'severance'];

      for (const { subreddit, query, limit } of searches) {
        try {
          // Add delay between requests to avoid rate limiting (2 seconds for safety)
          if (allPosts.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&limit=${limit}&t=month`;

          const response = await fetch(url, {
            headers: {
              'User-Agent': 'bWARNed/1.0',
            },
          });

          if (!response.ok) {
            console.error(`Reddit returned ${response.status} for r/${subreddit}`);
            continue;
          }

          const data = await response.json();
          const posts = data.data?.children || [];

          posts.forEach((child: any) => {
            const post = child.data;
            const titleAndText = (post.title + ' ' + (post.selftext || '')).toLowerCase();

            // Filter: only include posts that contain our target keywords
            const hasKeyword = keywords.some(keyword => titleAndText.includes(keyword));

            if (hasKeyword) {
              allPosts.push({
                id: post.id,
                title: post.title,
                author: post.author,
                created: post.created_utc,
                url: post.url,
                permalink: `https://reddit.com${post.permalink}`,
                selftext: post.selftext || '',
                subreddit: post.subreddit,
                score: post.score,
                num_comments: post.num_comments,
                company: extractCompany(post.title + ' ' + post.selftext),
              });
            }
          });
        } catch (err) {
          console.error(`Error fetching from r/${subreddit}:`, err);
          // Continue to next subreddit instead of failing completely
        }
      }

      if (allPosts.length === 0) {
        throw new Error('Could not fetch Reddit posts. Reddit may be rate limiting requests. Try pull-to-refresh in a few minutes.');
      }

      // Remove duplicates and sort by date
      const uniquePosts = Array.from(new Map(allPosts.map(post => [post.id, post])).values());
      const sortedPosts = uniquePosts.sort((a, b) => b.created - a.created);

      // Cache the results and timestamp
      await AsyncStorage.setItem(REDDIT_CACHE_KEY, JSON.stringify(sortedPosts));
      await AsyncStorage.setItem(REDDIT_LAST_FETCH_KEY, Date.now().toString());

      setPosts(sortedPosts);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleRefresh() {
    // Disable refresh on web
    if (Platform.OS === 'web') {
      setError('Reddit integration is only available on mobile due to browser CORS restrictions.');
      return;
    }

    // Check if enough time has passed since last fetch
    const lastFetchStr = await AsyncStorage.getItem(REDDIT_LAST_FETCH_KEY);
    if (lastFetchStr) {
      const lastFetch = parseInt(lastFetchStr, 10);
      const timeSinceLastFetch = Date.now() - lastFetch;

      if (timeSinceLastFetch < REDDIT_REFRESH_COOLDOWN_MS) {
        const minutesRemaining = Math.ceil((REDDIT_REFRESH_COOLDOWN_MS - timeSinceLastFetch) / 60000);
        setError(`Please wait ${minutesRemaining} more minute${minutesRemaining > 1 ? 's' : ''} before refreshing.`);
        setRefreshing(false);
        return;
      }
    }

    setRefreshing(true);
    setError(null);
    await fetchRedditPosts();
    setRefreshing(false);
  }

  return (
    <ScreenShell
      loading={loading}
      error={error}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search Reddit posts"
    >
      <RedditScreen posts={posts} searchQuery={searchQuery} />
    </ScreenShell>
  );
}

function RedditScreen({ posts, searchQuery }: { posts: RedditPost[]; searchQuery: string }) {
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [range, setRange] = useState<NoticeRangeKey>('30d');

  // Filter by time range first, then by search query
  const rangeFilteredPosts = getRedditPostsForRange(posts, range);
  const filteredPosts = filterRedditPosts(rangeFilteredPosts, searchQuery);

  const rangeTitle = range === '7d'
    ? 'Reddit discussions, last 7 days'
    : range === '30d'
    ? 'Reddit discussions, last 30 days'
    : 'Reddit discussions, all time';

  return (
    <View style={styles.screen}>
      <SegmentedControl options={noticeRanges} selected={range} onSelect={setRange} />

      <Section eyebrow="Community Source" title={rangeTitle}>
        {filteredPosts.length ? (
          filteredPosts.map((post) => (
            <RedditPostRow
              key={post.id}
              post={post}
              isExpanded={expandedPost === post.id}
              onToggle={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>No Reddit posts found for this time period.</Text>
        )}
      </Section>
    </View>
  );
}

function RedditPostRow({ post, isExpanded, onToggle }: { post: RedditPost; isExpanded: boolean; onToggle: () => void }) {
  const date = new Date(post.created * 1000);

  return (
    <View>
      <Pressable
        onPress={onToggle}
        style={[styles.redditPostRow, isExpanded && styles.redditPostRowExpanded]}
      >
        <View style={styles.redditPostHeader}>
          <View style={styles.redditMetaRow}>
            <Text style={styles.redditSubreddit}>r/{post.subreddit}</Text>
            <Text style={styles.redditAuthor}>u/{post.author}</Text>
            <Text style={styles.redditDate}>{formatRedditDate(post.created)}</Text>
          </View>
          <Text style={styles.redditTitle} numberOfLines={isExpanded ? undefined : 2}>
            {post.title}
          </Text>
          <View style={styles.redditStats}>
            <Text style={styles.redditScore}>▲ {post.score}</Text>
            <Text style={styles.redditComments}>💬 {post.num_comments}</Text>
          </View>
        </View>
        <Text style={styles.expandIndicator}>{isExpanded ? '▼' : '▶'}</Text>
      </Pressable>
      {isExpanded && (
        <View style={styles.redditPostDetails}>
          {post.selftext && (
            <View style={styles.redditSelfText}>
              <Text style={styles.redditSelfTextContent} numberOfLines={10}>
                {post.selftext}
              </Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Posted</Text>
            <Text style={styles.detailValue}>
              {date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Score</Text>
            <Text style={styles.detailValue}>{post.score.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Comments</Text>
            <Text style={styles.detailValue}>{post.num_comments.toLocaleString()}</Text>
          </View>
          <Pressable
            style={styles.redditLinkButton}
            onPress={() => {
              Linking.openURL(post.permalink).catch((err) => console.error('Failed to open URL:', err));
            }}
          >
            <Text style={styles.redditLinkButtonText}>View on Reddit →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function extractCompany(text: string): string | undefined {
  // Extract capitalized company names (basic pattern)
  const companyPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  const matches = text.match(companyPattern);

  if (matches && matches.length > 0) {
    return matches[0];
  }

  return undefined;
}

function getRedditPostsForRange(posts: RedditPost[], range: NoticeRangeKey): RedditPost[] {
  const sorted = [...posts].sort((a, b) => b.created - a.created);

  if (range === '7d') {
    const cutoff = Date.now() / 1000 - 7 * 24 * 60 * 60;
    return sorted.filter(post => post.created >= cutoff);
  }

  if (range === '30d') {
    const cutoff = Date.now() / 1000 - 30 * 24 * 60 * 60;
    return sorted.filter(post => post.created >= cutoff);
  }

  return sorted;
}

function filterRedditPosts(posts: RedditPost[], query: string): RedditPost[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return posts;
  }

  return posts.filter((post) =>
    `${post.title} ${post.selftext} ${post.subreddit} ${post.author} ${post.company || ''}`.toLowerCase().includes(normalizedQuery)
  );
}

function formatRedditDate(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 3600) {
    return `${Math.floor(diff / 60)}m ago`;
  } else if (diff < 86400) {
    return `${Math.floor(diff / 3600)}h ago`;
  } else if (diff < 604800) {
    return `${Math.floor(diff / 86400)}d ago`;
  } else {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function CompanyLogo({ company, refreshKey }: { company: string; refreshKey?: number }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const logoSources = getLogoSources(company);
  const logoUrl = logoSources[sourceIndex];

  // Reset source index when refreshKey changes
  useEffect(() => {
    setSourceIndex(0);
  }, [refreshKey]);

  return (
    <View style={styles.companyLogo}>
      {logoUrl ? (
        <Image
          key={`${company}-${refreshKey}`}
          resizeMode="contain"
          source={{ uri: logoUrl }}
          onError={() => setSourceIndex((current) => current + 1)}
          style={styles.companyLogoImage}
        />
      ) : (
        <Text style={styles.companyLogoText}>{companyInitials(company)}</Text>
      )}
    </View>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function SegmentedControl<T extends string>({
  onSelect,
  options,
  selected,
}: {
  onSelect: (value: T) => void;
  options: { key: T; label: string }[];
  selected: T;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((option) => (
        <Pressable
          accessibilityRole="button"
          key={option.key}
          onPress={() => onSelect(option.key)}
          style={[styles.segmentButton, selected === option.key && styles.segmentButtonActive]}
        >
          <Text style={[styles.segmentText, selected === option.key && styles.segmentTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Section({ children, eyebrow, title }: { children: ReactNode; eyebrow: string; title: string }) {
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

function RankList({ emptyLabel, logoRefreshKey, rows, showStock = false }: { emptyLabel: string; logoRefreshKey?: number; rows: RankedRow[]; showStock?: boolean }) {
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
          logoRefreshKey={logoRefreshKey}
          row={row}
          showStock={showStock}
          isExpanded={expandedCompany === row.label}
          onToggle={() => setExpandedCompany(expandedCompany === row.label ? null : row.label)}
        />
      ))}
    </View>
  );
}

function CompanyRow({ index, logoRefreshKey, row, showStock = false, isExpanded = false, onToggle }: { index: number; logoRefreshKey?: number; row: RankedRow; showStock?: boolean; isExpanded?: boolean; onToggle?: () => void }) {
  const ticker = row.ticker || guessCompanyTicker(row.label);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Disable stock quotes on web due to CORS
    if (!showStock || !ticker || Platform.OS === 'web') {
      return;
    }

    let active = true;

    async function loadQuote() {
      try {
        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0',
          },
        });
        const json = await response.json();
        const result = json?.chart?.result?.[0]?.meta;
        if (!active || !result?.regularMarketPrice) {
          setFailed(true);
          return;
        }

        const price = Number(result.regularMarketPrice);
        const previousClose = Number(result.previousClose);
        const changePercent = Number.isFinite(previousClose) && previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : undefined;

        setQuote({
          currency: result.currency ?? 'USD',
          marketState: result.marketState ?? '',
          price,
          regularMarketChangePercent: changePercent,
          regularMarketTime: result.regularMarketTime,
          symbol: result.symbol ?? ticker,
        });
      } catch {
        if (active) {
          setFailed(true);
        }
      }
    }

    loadQuote();
    const refreshInterval = setInterval(() => {
      if (active) {
        loadQuote();
      }
    }, 1000);

    return () => {
      active = false;
      clearInterval(refreshInterval);
    };
  }, [showStock, ticker]);

  const direction = quote && Number.isFinite(quote.regularMarketChangePercent ?? NaN) && (quote.regularMarketChangePercent ?? 0) >= 0;

  return (
    <View>
      <Pressable
        onPress={onToggle}
        style={[styles.companyRow, isExpanded && styles.companyRowExpanded]}
      >
        <View style={styles.logoStack}>
          <CompanyLogo company={row.label} refreshKey={logoRefreshKey} />
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>{index + 1}</Text>
          </View>
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
          {showStock && ticker && !failed && quote && (
            <Text style={[styles.stockText, direction ? styles.stockUp : styles.stockDown]} numberOfLines={1}>
              {quote.symbol} {formatCurrency(quote.price, quote.currency)}
            </Text>
          )}
        </View>
        {onToggle && (
          <Text style={styles.expandIndicator}>{isExpanded ? '▼' : '▶'}</Text>
        )}
      </Pressable>
      {isExpanded && (
        <View style={styles.companyDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Company</Text>
            <Text style={styles.detailValue}>{row.label}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Notices</Text>
            <Text style={styles.detailValue}>{row.notices.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Workers Affected</Text>
            <Text style={styles.detailValue}>{row.value.toLocaleString()}</Text>
          </View>
          {row.meta && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>States</Text>
              <Text style={styles.detailValue}>{row.meta}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Average per Notice</Text>
            <Text style={styles.detailValue}>{Math.round(row.value / row.notices).toLocaleString()}</Text>
          </View>
          {showStock && ticker && !failed && quote && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Stock Symbol</Text>
                <Text style={styles.detailValue}>{quote.symbol}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Stock Price</Text>
                <Text style={[styles.detailValue, direction ? styles.stockUp : styles.stockDown]}>
                  {formatCurrency(quote.price, quote.currency)}
                  {Number.isFinite(quote.regularMarketChangePercent) && ` (${direction ? '+' : ''}${quote.regularMarketChangePercent?.toFixed(2)}%)`}
                </Text>
              </View>
              {quote.regularMarketTime && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Price Updated</Text>
                  <Text style={styles.detailValue}>
                    {new Date(quote.regularMarketTime * 1000).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function BarList({ rows }: { rows: RankedRow[] }) {
  if (!rows.length) {
    return <Text style={styles.emptyText}>No telemetry available.</Text>;
  }

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

function HorizontalBarList({ rows }: { rows: RankedRow[] }) {
  if (!rows.length) {
    return <Text style={styles.emptyText}>No telemetry available.</Text>;
  }

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalBarList}
    >
      {rows.map((row, index) => (
        <View key={row.label} style={styles.horizontalBarCard}>
          <Text style={styles.horizontalBarLabel} numberOfLines={2}>
            {row.label}
          </Text>
          <Text style={styles.horizontalBarValue}>{row.value.toLocaleString()}</Text>
          <Text style={styles.horizontalBarSubtext}>workers</Text>
          <View style={styles.horizontalBarTrack}>
            <View
              style={[
                styles.horizontalBarFill,
                {
                  backgroundColor: index === 0 ? palette.red : palette.ink,
                  height: `${Math.max((row.value / max) * 100, 5)}%`,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function NoticeRow({ logoRefreshKey, notice, isExpanded = false, onToggle }: { logoRefreshKey?: number; notice: WarnNotice; isExpanded?: boolean; onToggle?: () => void }) {
  return (
    <View>
      <Pressable
        onPress={onToggle}
        style={[styles.noticeRow, isExpanded && styles.noticeRowExpanded]}
      >
        <View style={styles.noticeDateBlock}>
          <Text style={styles.noticeMonth}>{formatMonth(notice.date)}</Text>
          <Text style={styles.noticeDay}>{formatDay(notice.date)}</Text>
        </View>
        <CompanyLogo company={notice.company} refreshKey={logoRefreshKey} />
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
        {onToggle && (
          <Text style={styles.expandIndicator}>{isExpanded ? '▼' : '▶'}</Text>
        )}
      </Pressable>
      {isExpanded && (
        <View style={styles.companyDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Company</Text>
            <Text style={styles.detailValue}>{notice.company}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{new Date(notice.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={styles.detailValue}>{notice.city}, {notice.state}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Industry</Text>
            <Text style={styles.detailValue}>{notice.industry}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Workers Affected</Text>
            <Text style={styles.detailValue}>{notice.employees.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Reason</Text>
            <Text style={styles.detailValue}>{notice.reason}</Text>
          </View>
        </View>
      )}
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

  return {
    totalNotices: notices.length,
    totalEmployees,
    companyCount: Object.keys(companies).length,
    industryCount: Object.keys(industries).length,
    stateCount: Object.keys(states).length,
    averageImpact: notices.length ? Math.round(totalEmployees / notices.length) : 0,
    last7: summarize(last7Notices),
    last30: summarize(last30Notices),
    topCompanies7: rankGroups(groupBy(last7Notices, (notice) => notice.company)),
    topCompanies30: rankGroups(groupBy(last30Notices, (notice) => notice.company)),
    topCompaniesAll: rankGroups(companies),
    topStates7: rankGroups(groupBy(last7Notices, (notice) => notice.state || 'NA')),
    topStates: rankGroups(states),
    topIndustries7: rankGroups(groupBy(last7Notices, (notice) => notice.industry || 'Unclassified')),
    topIndustries30: rankGroups(groupBy(last30Notices, (notice) => notice.industry || 'Unclassified')),
    topIndustries: rankGroups(industries),
    recentNotices: sorted.slice(0, 25),
  };
}

function summarize(records: WarnNotice[]) {
  return {
    notices: records.length,
    employees: records.reduce((sum, notice) => sum + notice.employees, 0),
  };
}

function getCompanyRowsForRange(analytics: Analytics, range: CompanyRangeKey) {
  if (range === '7d') {
    return analytics.topCompanies7;
  }

  if (range === '30d') {
    return analytics.topCompanies30;
  }

  return analytics.topCompaniesAll;
}

function getRegionRowsForRange(analytics: Analytics, range: CompanyRangeKey) {
  if (range === '7d') {
    return analytics.topStates7;
  }

  if (range === '30d') {
    return analytics.topStates;
  }

  return analytics.topStates;
}

function getIndustryRowsForRange(analytics: Analytics, range: CompanyRangeKey) {
  if (range === '7d') {
    return analytics.topIndustries7;
  }

  if (range === '30d') {
    return analytics.topIndustries30;
  }

  return analytics.topIndustries;
}

function companyRangeTitle(range: CompanyRangeKey) {
  if (range === '7d') {
    return 'Top companies, last 7 days';
  }

  if (range === '30d') {
    return 'Top companies, last 30 days';
  }

  return 'Top companies, all time';
}

function getNoticesForRange(notices: WarnNotice[], range: NoticeRangeKey) {
  const sorted = [...notices].sort((a, b) => toTime(b.date) - toTime(a.date));
  if (range === '7d') {
    return filterWithinDays(sorted, 7);
  }

  if (range === '30d') {
    return filterWithinDays(sorted, 30);
  }

  return sorted;
}

function noticeRangeTitle(range: NoticeRangeKey) {
  if (range === '7d') {
    return 'WARN notices, last 7 days';
  }

  if (range === '30d') {
    return 'WARN notices, last 30 days';
  }

  return 'WARN notices, all time';
}

function getMomentumTitle(range: CompanyRangeKey) {
  if (range === '7d') {
    return 'Top 5 companies, last 7 days';
  }

  if (range === '30d') {
    return 'Top 5 companies, last 30 days';
  }

  return 'Top 5 companies, all time';
}

function getRegionsTitle(range: CompanyRangeKey) {
  if (range === '7d') {
    return 'Top 5 regions, last 7 days';
  }

  if (range === '30d') {
    return 'Top 5 regions, last 30 days';
  }

  return 'Top 5 regions, all time';
}

function getIndustriesTitle(range: CompanyRangeKey) {
  if (range === '7d') {
    return 'Top 5 industries, last 7 days';
  }

  if (range === '30d') {
    return 'Top 5 industries, last 30 days';
  }

  return 'Top 5 industries, all time';
}

function filterRankedRows(rows: RankedRow[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return rows;
  }

  return rows.filter((row) => `${row.label} ${row.meta ?? ''}`.toLowerCase().includes(normalizedQuery));
}

function filterNotices(notices: WarnNotice[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return notices;
  }

  return notices.filter((notice) =>
    `${notice.company} ${notice.city} ${notice.state} ${notice.industry} ${notice.reason}`.toLowerCase().includes(normalizedQuery)
  );
}

function rankGroups(groups: Record<string, WarnNotice[]>): RankedRow[] {
  return Object.entries(groups)
    .map(([label, group]) => {
      // Find the first ticker in this group
      const ticker = group.find((notice) => notice.ticker)?.ticker;

      return {
        label,
        value: group.reduce((sum, notice) => sum + notice.employees, 0),
        notices: group.length,
        meta: compactUnique(group.map((notice) => notice.state)).slice(0, 3).join(', '),
        ticker: ticker || undefined,
      };
    })
    .sort((a, b) => b.value - a.value);
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

function getLogoSources(company: string) {
  const domain = guessCompanyDomain(company);
  if (!domain) {
    return [];
  }

  return [
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://unavatar.io/${domain}`,
  ];
}

function guessCompanyDomain(company: string) {
  const cleaned = company
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|company|co|services|service|holdings|group|usa|us|the)\b/g, ' ')
    .replace(/[^a-z0-9. ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const matchedKey = Object.keys(knownCompanyDomains).find((key) => cleaned.includes(key));
  if (matchedKey) {
    return knownCompanyDomains[matchedKey];
  }

  const domainLike = cleaned.split(' ').find((part) => part.includes('.') && part.length > 3);
  const domain = domainLike ?? `${cleaned.split(' ')[0]}.com`;
  return domain && domain !== '.com' ? domain : '';
}

function guessCompanyTicker(company: string) {
  const cleaned = cleanCompanyName(company);
  const matchedKey = Object.keys(knownCompanyTickers).find((key) => cleaned.includes(key));
  return matchedKey ? knownCompanyTickers[matchedKey] : '';
}

function cleanCompanyName(company: string) {
  return company
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|company|co|services|service|holdings|group|usa|us|the)\b/g, ' ')
    .replace(/[^a-z0-9. ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function companyInitials(company: string) {
  const words = company
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2);

  return words.map((word) => word[0]).join('').toUpperCase() || 'W';
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
  const ticker = text(record.ticker);

  return {
    id: text(record.id, record.record_id, record.notice_id) || `${company}-${date}-${index}`,
    company,
    city: text(record.city, record.location_city, record.worksite_city) || 'Unknown city',
    state: state || 'NA',
    industry: text(record.industry, record.naics_industry, record.sector) || 'Unclassified',
    date: date || new Date().toISOString(),
    employees: number(record.employees_affected, record.workers_affected, record.employees, record.total_layoffs, record.count),
    reason: text(record.reason, record.closure_type, record.notice_type, record.type) || 'WARN notice',
    ticker: ticker || undefined,
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


function formatUpdateTime(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    currency: currency || 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value);
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
  navigatorBar: {
    backgroundColor: palette.panel,
    borderTopColor: palette.faint,
    paddingTop: 0,
  },
  topNavigatorBar: {
    backgroundColor: palette.panel,
    borderBottomColor: palette.faint,
    borderBottomWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  navigatorItem: {
    paddingBottom: 0,
    paddingTop: 2,
  },
  navigatorIconSlot: {
    marginBottom: -3,
    marginTop: 0,
  },
  navigatorLabel: {
    fontSize: 10,
    fontWeight: '900',
  },
  navigatorIcon: {
    fontSize: 14,
    fontWeight: '900',
  },
  tabGlyph: {
    alignItems: 'center',
    borderRadius: 8,
    height: 24,
    justifyContent: 'center',
    width: 30,
  },
  tabGlyphActive: {
    backgroundColor: palette.redSoft,
  },
  content: {
    gap: 16,
    padding: 18,
    paddingBottom: 14,
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
    height: 55,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 62,
  },
  searchInputContainer: {
    flex: 1,
    position: 'relative',
  },
  headerSearchInput: {
    backgroundColor: palette.panel,
    borderColor: palette.faint,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingRight: 40,
    paddingVertical: 10,
  },
  clearButton: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 44,
  },
  clearButtonText: {
    color: palette.muted,
    fontSize: 18,
    fontWeight: '700',
  },
  refreshButton: {
    backgroundColor: palette.red,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonDisabled: {
    backgroundColor: palette.muted,
    opacity: 0.6,
  },
  refreshButtonText: {
    color: palette.panel,
    fontSize: 14,
    fontWeight: '900',
  },
  logoText: {
    color: palette.panel,
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
    textAlign: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: palette.ink,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
    marginTop: 3,
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
    flex: 1,
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
  screen: {
    gap: 16,
  },
  loadingPanel: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 200,
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
  searchInput: {
    backgroundColor: palette.panel,
    borderColor: palette.faint,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmentRow: {
    backgroundColor: palette.soft,
    borderColor: palette.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentButtonActive: {
    backgroundColor: palette.panel,
  },
  segmentText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: palette.ink,
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
  companyRowExpanded: {
    backgroundColor: palette.soft,
    borderBottomWidth: 0,
    borderRadius: 8,
    marginHorizontal: -8,
    paddingHorizontal: 20,
  },
  expandIndicator: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  companyDetails: {
    backgroundColor: palette.panel,
    borderBottomColor: palette.faint,
    borderBottomWidth: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLabel: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  detailValue: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
    flex: 2,
    textAlign: 'right',
  },
  logoStack: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  companyLogo: {
    alignItems: 'center',
    backgroundColor: palette.soft,
    borderColor: palette.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 36,
  },
  companyLogoImage: {
    height: 36,
    width: 36,
  },
  companyLogoText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
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
  stockText: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 4,
    maxWidth: 90,
  },
  stockUp: {
    color: palette.green,
  },
  stockDown: {
    color: palette.red,
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
  horizontalBarList: {
    gap: 12,
    paddingRight: 16,
  },
  horizontalBarCard: {
    backgroundColor: palette.soft,
    borderColor: palette.faint,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 160,
    padding: 12,
    width: 120,
  },
  horizontalBarLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
    height: 36,
    lineHeight: 17,
  },
  horizontalBarValue: {
    color: palette.red,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  horizontalBarSubtext: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  horizontalBarTrack: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderRadius: 6,
    flex: 1,
    justifyContent: 'flex-end',
    marginTop: 12,
    overflow: 'hidden',
    width: '100%',
  },
  horizontalBarFill: {
    borderRadius: 6,
    width: '100%',
  },
  noticeRow: {
    alignItems: 'center',
    borderBottomColor: palette.faint,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 13,
  },
  noticeRowExpanded: {
    backgroundColor: palette.soft,
    borderBottomWidth: 0,
    borderRadius: 8,
    marginHorizontal: -8,
    paddingHorizontal: 20,
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
  horizontalSectionsContainer: {
    gap: 12,
    paddingRight: 18,
  },
  horizontalSectionsContainerWeb: {
    flexDirection: 'row',
    gap: 12,
  },
  horizontalSectionWeb: {
    flex: 1,
    width: undefined,
    alignSelf: 'stretch',
  },
  horizontalSection: {
    backgroundColor: palette.panel,
    borderColor: palette.faint,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    width: 340,
  },
  horizontalSectionEyebrow: {
    color: palette.red,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  horizontalSectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  horizontalSectionBody: {
    marginTop: 14,
  },
  redditPostRow: {
    borderBottomColor: palette.faint,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
  },
  redditPostRowExpanded: {
    backgroundColor: palette.soft,
    borderBottomWidth: 0,
    borderRadius: 8,
    marginHorizontal: -8,
    paddingHorizontal: 20,
  },
  redditPostHeader: {
    flex: 1,
    gap: 8,
  },
  redditMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  redditSubreddit: {
    color: palette.red,
    fontSize: 12,
    fontWeight: '900',
  },
  redditAuthor: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  redditDate: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  redditTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
  },
  companyTag: {
    alignSelf: 'flex-start',
    backgroundColor: palette.redSoft,
    borderColor: '#ffd1c5',
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  companyTagText: {
    color: palette.red,
    fontSize: 11,
    fontWeight: '900',
  },
  redditStats: {
    flexDirection: 'row',
    gap: 16,
  },
  redditScore: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  redditComments: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  redditPostDetails: {
    backgroundColor: palette.panel,
    borderBottomColor: palette.faint,
    borderBottomWidth: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  redditSelfText: {
    backgroundColor: palette.soft,
    borderRadius: 6,
    padding: 12,
  },
  redditSelfTextContent: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 19,
  },
  redditLinkButton: {
    alignItems: 'center',
    backgroundColor: palette.red,
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 12,
  },
  redditLinkButtonText: {
    color: palette.panel,
    fontSize: 14,
    fontWeight: '900',
  },
});
