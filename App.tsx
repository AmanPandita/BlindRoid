import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

type AlertTopicKey = 'weeklyCompanies' | 'monthlyCompanies' | 'weeklyRegions' | 'monthlyIndustries' | 'weeklyDigest';
type RootTabParamList = {
  Overview: undefined;
  Companies: undefined;
  Regions: undefined;
  Notices: undefined;
  Alerts: undefined;
};

type RankedRow = {
  label: string;
  value: number;
  notices: number;
  meta?: string;
};
type CompanyRangeKey = '7d' | '30d' | 'all';
type NoticeRangeKey = 'recent' | '30d' | 'all';
type StockQuote = {
  currency: string;
  marketState: string;
  price: number;
  regularMarketChangePercent?: number;
  symbol: string;
};

const WARN_API_KEY = process.env.EXPO_PUBLIC_WARN_FIREHOSE_API_KEY ?? '';
const WARN_ENDPOINT = 'https://warnfirehose.com/api/records?limit=5000';
const CACHE_KEY = 'warnfirehose.warn_notices.v1';
const ALERT_SETTINGS_KEY = 'warnfirehose.alert_settings.v1';
const ALERT_NOTIFICATION_IDS_KEY = 'warnfirehose.alert_notification_ids.v1';
const ALERT_ONBOARDING_KEY = 'warnfirehose.alert_onboarding_sent.v1';
const ALERT_PERMISSION_PROMPTED_KEY = 'warnfirehose.alert_permission_prompted.v1';
const DAILY_API_CALL_TARGET = 10;
const CACHE_REFRESH_INTERVAL_MS = (24 * 60 * 60 * 1000) / DAILY_API_CALL_TARGET;
const CACHE_REFRESH_CHECK_MS = 60 * 1000;
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

const alertTopics: { key: AlertTopicKey; label: string; description: string }[] = [
  { key: 'weeklyCompanies', label: 'Top company weekly', description: 'Largest WARN company movement over the last 7 days.' },
  { key: 'monthlyCompanies', label: 'Top company monthly', description: 'Largest WARN company movement over the last 30 days.' },
  { key: 'weeklyRegions', label: 'Top region weekly', description: 'State-level WARN concentration from the recent feed.' },
  { key: 'monthlyIndustries', label: 'Top industry monthly', description: 'Sector stress from WARN notices in the latest month.' },
  { key: 'weeklyDigest', label: 'Weekly digest', description: 'A compact summary of notices, workers, companies, and states.' },
];

const Tab = createBottomTabNavigator<RootTabParamList>();
const navigationRef = createNavigationContainerRef<RootTabParamList>();

const companyRanges: { key: CompanyRangeKey; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: 'all', label: 'All' },
];

const noticeRanges: { key: NoticeRangeKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
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

  useEffect(() => {
    loadCachedOrFetch();
    const refreshTimer = setInterval(() => {
      refreshCacheIfDue().catch((nextError) => setError(getErrorMessage(nextError)));
    }, CACHE_REFRESH_CHECK_MS);

    return () => clearInterval(refreshTimer);
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
        setLastUpdatedAt(payload.savedAt);

        if (!shouldRefreshCache(payload.savedAt)) {
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
    setLastUpdatedAt(savedAt);
  }

  async function refreshCacheIfDue() {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const payload = JSON.parse(cached) as CachePayload;
      if (!shouldRefreshCache(payload.savedAt)) {
        return;
      }
    }

    await fetchAndCache();
  }

  async function bootstrapNotificationPermission() {
    const [permissions, prompted] = await Promise.all([
      Notifications.getPermissionsAsync(),
      AsyncStorage.getItem(ALERT_PERMISSION_PROMPTED_KEY),
    ]);

    if (!prompted && permissions.status === 'undetermined') {
      openAlertsTab();
      const requested = await Notifications.requestPermissionsAsync();
      await AsyncStorage.setItem(ALERT_PERMISSION_PROMPTED_KEY, new Date().toISOString());
      if (requested.granted) {
        await sendNotificationOnboardingConfirmation();
      }
      return;
    }
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} onReady={() => bootstrapNotificationPermission()}>
        <StatusBar style="dark" />
        <AppTabs
          analytics={analytics}
          error={error}
          lastUpdatedAt={lastUpdatedAt}
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
  loading,
  notices,
  totalCount,
}: {
  analytics: Analytics;
  error: string | null;
  lastUpdatedAt: string | null;
  loading: boolean;
  notices: WarnNotice[];
  totalCount: number;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: {
          backgroundColor: palette.page,
        },
        tabBarActiveTintColor: palette.red,
        tabBarInactiveTintColor: palette.muted,
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
        tabBarIcon: ({ color, focused }) => <TabGlyph color={color} focused={focused} name={route.name as keyof RootTabParamList} />,
      })}
    >
      <Tab.Screen name="Overview">
        {() => (
          <ScreenShell loading={loading} error={error}>
            <OverviewScreen
              analytics={analytics}
              lastUpdatedAt={lastUpdatedAt}
              totalCount={totalCount}
            />
          </ScreenShell>
        )}
      </Tab.Screen>
      <Tab.Screen name="Companies">
        {() => (
          <ScreenShell loading={loading} error={error}>
            <CompaniesScreen analytics={analytics} />
          </ScreenShell>
        )}
      </Tab.Screen>
      <Tab.Screen name="Regions">
        {() => (
          <ScreenShell loading={loading} error={error}>
            <RegionsScreen analytics={analytics} />
          </ScreenShell>
        )}
      </Tab.Screen>
      <Tab.Screen name="Notices">
        {() => (
          <ScreenShell loading={loading} error={error}>
            <NoticesScreen notices={notices} />
          </ScreenShell>
        )}
      </Tab.Screen>
      <Tab.Screen name="Alerts">
        {() => (
          <ScreenShell loading={loading} error={error}>
            <AlertsScreen analytics={analytics} />
          </ScreenShell>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function ScreenShell({ children, error, loading }: { children: ReactNode; error: string | null; loading: boolean }) {
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 18 }]}
        showsVerticalScrollIndicator={false}
      >
        <Header />
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
            {children}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.logoRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>B</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>WARN layoff intelligence</Text>
        </View>
      </View>
    </View>
  );
}

function openAlertsTab() {
  setTimeout(() => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Alerts');
    }
  }, 250);
}

async function sendNotificationOnboardingConfirmation() {
  const sent = await AsyncStorage.getItem(ALERT_ONBOARDING_KEY);
  if (sent) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'WARN alerts enabled',
      body: 'Choose the weekly layoff signals you want to receive next.',
    },
    trigger: null,
  });
  await AsyncStorage.setItem(ALERT_ONBOARDING_KEY, new Date().toISOString());
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
    case 'Alerts':
      return (
        <>
          <Path d="M18 10a6 6 0 0 0-12 0c0 6-2 6-2 8h16c0-2-2-2-2-8Z" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={2.1} />
          <Path d="M10 21h4" stroke={color} strokeLinecap="round" strokeWidth={2.1} />
        </>
      );
  }
}

function OverviewScreen({ analytics, lastUpdatedAt, totalCount }: { analytics: Analytics; lastUpdatedAt: string | null; totalCount: number }) {
  const [companyQuery, setCompanyQuery] = useState('');
  const topCompanies = filterRankedRows(analytics.topCompanies30, companyQuery).slice(0, 8);
  const allCompanies = filterRankedRows(analytics.topCompaniesAll, companyQuery).slice(0, 20);

  return (
    <View style={styles.screen}>
      <View style={styles.metaRow}>
        <MetaPill label="Last updated" value={lastUpdatedAt ? formatUpdateTime(lastUpdatedAt) : 'Pending'} />
        <MetaPill label="Cached" value={`${totalCount.toLocaleString()} notices`} />
      </View>

      <SearchBox value={companyQuery} onChangeText={setCompanyQuery} placeholder="Search companies" />

      <Section eyebrow="Momentum" title="Top companies, last 30 days">
        <RankList rows={topCompanies} emptyLabel="No matching companies in the last 30 days." showStock />
      </Section>

      <Section eyebrow="Company directory" title="All companies">
        <RankList rows={allCompanies} emptyLabel="No matching company telemetry available." showStock />
      </Section>
    </View>
  );
}

function CompaniesScreen({ analytics }: { analytics: Analytics }) {
  const [range, setRange] = useState<CompanyRangeKey>('30d');
  const [companyQuery, setCompanyQuery] = useState('');
  const rows = filterRankedRows(getCompanyRowsForRange(analytics, range), companyQuery).slice(0, 25);

  return (
    <View style={styles.screen}>
      <SearchBox value={companyQuery} onChangeText={setCompanyQuery} placeholder="Search companies" />
      <SegmentedControl options={companyRanges} selected={range} onSelect={setRange} />

      <Section eyebrow="Companies" title={companyRangeTitle(range)}>
        <RankList rows={rows} emptyLabel="No matching company telemetry available." />
      </Section>
    </View>
  );
}

function RegionsScreen({ analytics }: { analytics: Analytics }) {
  const [regionQuery, setRegionQuery] = useState('');
  const stateRows = filterRankedRows(analytics.topStates, regionQuery);
  const industryRows = filterRankedRows(analytics.topIndustries, regionQuery);

  return (
    <View style={styles.screen}>
      <SearchBox value={regionQuery} onChangeText={setRegionQuery} placeholder="Search states or industries" />

      <View style={styles.metricGrid}>
        <MetricCard label="States" value={analytics.stateCount.toLocaleString()} detail="with WARN filings" accent={palette.red} />
        <MetricCard label="Industries" value={analytics.industryCount.toLocaleString()} detail="represented" accent={palette.ink} />
      </View>

      <Section eyebrow="Geography" title="State exposure">
        <BarList rows={stateRows} />
      </Section>

      <Section eyebrow="Sectors" title="Industry stress">
        <BarList rows={industryRows} />
      </Section>
    </View>
  );
}

function NoticesScreen({ notices }: { notices: WarnNotice[] }) {
  const [range, setRange] = useState<NoticeRangeKey>('recent');
  const [noticeQuery, setNoticeQuery] = useState('');
  const visibleNotices = filterNotices(getNoticesForRange(notices, range), noticeQuery).slice(0, 50);

  return (
    <View style={styles.screen}>
      <SearchBox value={noticeQuery} onChangeText={setNoticeQuery} placeholder="Search notices" />
      <SegmentedControl options={noticeRanges} selected={range} onSelect={setRange} />

      <Section eyebrow="Company tape" title={noticeRangeTitle(range)}>
        {visibleNotices.length ? (
          visibleNotices.map((notice) => (
            <NoticeRow key={notice.id} notice={notice} />
          ))
        ) : (
          <Text style={styles.emptyText}>No matching WARN notices.</Text>
        )}
      </Section>
    </View>
  );
}

function AlertsScreen({ analytics }: { analytics: Analytics }) {
  const [permission, setPermission] = useState('unknown');
  const [alertQuery, setAlertQuery] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<AlertTopicKey[]>([]);
  const [statusMessage, setStatusMessage] = useState('Choose the weekly alerts you want to receive.');
  const enabled = permission === 'granted' && selectedTopics.length > 0;
  const visibleTopics = alertTopics.filter((topic) => `${topic.label} ${topic.description}`.toLowerCase().includes(alertQuery.trim().toLowerCase()));

  useEffect(() => {
    loadAlertPreferences();
  }, []);

  async function loadAlertPreferences() {
    const [settings, permissions] = await Promise.all([
      AsyncStorage.getItem(ALERT_SETTINGS_KEY),
      Notifications.getPermissionsAsync(),
    ]);
    setPermission(permissions.status);

    if (settings) {
      const parsed = JSON.parse(settings) as { topics?: AlertTopicKey[] };
      setSelectedTopics(parsed.topics ?? []);
    }
  }

  async function requestPermission() {
    const permissions = await Notifications.requestPermissionsAsync();
    setPermission(permissions.status);
    if (permissions.granted) {
      await sendNotificationOnboardingConfirmation();
    }
    setStatusMessage(
      permissions.granted ? 'Notifications are allowed. Pick one or more weekly alerts.' : 'Notifications are not enabled for this device.'
    );
    return permissions.granted;
  }

  async function toggleTopic(topic: AlertTopicKey) {
    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        return;
      }
    }

    setSelectedTopics((current) =>
      current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic]
    );
  }

  async function saveAlerts() {
    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        return;
      }
    }

    if (!selectedTopics.length) {
      await turnOffAlerts();
      return;
    }

    const ids = await scheduleWeeklyAlerts(selectedTopics, analytics);
    await AsyncStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify({ topics: selectedTopics, updatedAt: new Date().toISOString() }));
    await AsyncStorage.setItem(ALERT_NOTIFICATION_IDS_KEY, JSON.stringify(ids));
    await sendImmediateAlertPreview(selectedTopics, analytics);
    setStatusMessage('Weekly local notifications are scheduled for Monday at 9:00 AM. A confirmation was sent now.');
  }

  async function turnOffAlerts() {
    await clearScheduledAlertNotifications();
    await AsyncStorage.removeItem(ALERT_SETTINGS_KEY);
    setSelectedTopics([]);
    setStatusMessage('Weekly local notifications are turned off.');
  }

  return (
    <View style={styles.screen}>
      <SearchBox value={alertQuery} onChangeText={setAlertQuery} placeholder="Search alerts" />

      <Section eyebrow="Notifications" title="Weekly alert settings">
        <Text style={styles.alertIntro}>
          If notifications are allowed, choose the weekly layoff signals you want next. You can select multiple topics.
        </Text>

        <Pressable accessibilityRole="button" onPress={requestPermission} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{permission === 'granted' ? 'Notifications allowed' : 'Allow notifications'}</Text>
        </Pressable>

        <View style={styles.topicList}>
          {visibleTopics.map((topic) => {
            const selected = selectedTopics.includes(topic.key);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={topic.key}
                onPress={() => toggleTopic(topic.key)}
                style={[styles.topicRow, selected && styles.topicRowSelected]}
              >
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  <Text style={[styles.checkboxText, selected && styles.checkboxTextSelected]}>{selected ? 'on' : ''}</Text>
                </View>
                <View style={styles.topicCopy}>
                  <Text style={styles.topicLabel}>{topic.label}</Text>
                  <Text style={styles.topicDescription}>{topic.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.alertActions}>
          <Pressable accessibilityRole="button" onPress={saveAlerts} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{enabled ? 'Update weekly alerts' : 'Schedule selected alerts'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={turnOffAlerts} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Turn off alerts</Text>
          </Pressable>
        </View>

        <Text style={styles.statusText}>{statusMessage}</Text>
      </Section>
    </View>
  );
}

function CompanyLogo({ company }: { company: string }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const logoSources = getLogoSources(company);
  const logoUrl = logoSources[sourceIndex];

  return (
    <View style={styles.companyLogo}>
      {logoUrl ? (
        <Image
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

function SearchBox({ onChangeText, placeholder, value }: { onChangeText: (value: string) => void; placeholder: string; value: string }) {
  return (
    <TextInput
      autoCapitalize="none"
      clearButtonMode="while-editing"
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={palette.muted}
      style={styles.searchInput}
      value={value}
    />
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

function RankList({ emptyLabel, rows, showStock = false }: { emptyLabel: string; rows: RankedRow[]; showStock?: boolean }) {
  if (!rows.length) {
    return <Text style={styles.emptyText}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.rankList}>
      {rows.map((row, index) => (
        <CompanyRow key={`${row.label}-${index}`} index={index} row={row} showStock={showStock} />
      ))}
    </View>
  );
}

function CompanyRow({ index, row, showStock = false }: { index: number; row: RankedRow; showStock?: boolean }) {
  return (
    <View style={styles.companyRow}>
      <View style={styles.logoStack}>
        <CompanyLogo company={row.label} />
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
        {showStock ? <CompanyStockPrice company={row.label} /> : null}
      </View>
    </View>
  );
}

function CompanyStockPrice({ company }: { company: string }) {
  const ticker = guessCompanyTicker(company);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadQuote() {
      if (!ticker) {
        setFailed(true);
        return;
      }

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
          symbol: result.symbol ?? ticker,
        });
      } catch {
        if (active) {
          setFailed(true);
        }
      }
    }

    loadQuote();
    return () => {
      active = false;
    };
  }, [ticker]);

  if (!ticker || failed) {
    return null;
  }

  if (!quote) {
    return <Text style={styles.stockText}>{ticker}</Text>;
  }

  const direction = Number.isFinite(quote.regularMarketChangePercent ?? NaN) && (quote.regularMarketChangePercent ?? 0) >= 0;

  return (
    <Text style={[styles.stockText, direction ? styles.stockUp : styles.stockDown]} numberOfLines={1}>
      {quote.symbol} {formatCurrency(quote.price, quote.currency)}
    </Text>
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

function NoticeRow({ notice }: { notice: WarnNotice }) {
  return (
    <View style={styles.noticeRow}>
      <View style={styles.noticeDateBlock}>
        <Text style={styles.noticeMonth}>{formatMonth(notice.date)}</Text>
        <Text style={styles.noticeDay}>{formatDay(notice.date)}</Text>
      </View>
      <CompanyLogo company={notice.company} />
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

  return {
    totalNotices: notices.length,
    totalEmployees,
    companyCount: Object.keys(companies).length,
    industryCount: Object.keys(industries).length,
    stateCount: Object.keys(states).length,
    averageImpact: notices.length ? Math.round(totalEmployees / notices.length) : 0,
    last7: summarize(last7Notices),
    last30: summarize(last30Notices),
    topCompanies7: rankGroups(groupBy(last7Notices, (notice) => notice.company)).slice(0, 100),
    topCompanies30: rankGroups(groupBy(last30Notices, (notice) => notice.company)).slice(0, 100),
    topCompaniesAll: rankGroups(companies).slice(0, 100),
    topStates7: rankGroups(groupBy(last7Notices, (notice) => notice.state || 'NA')).slice(0, 8),
    topStates: rankGroups(states).slice(0, 8),
    topIndustries30: rankGroups(groupBy(last30Notices, (notice) => notice.industry || 'Unclassified')).slice(0, 8),
    topIndustries: rankGroups(industries).slice(0, 8),
    recentNotices: sorted.slice(0, 25),
  };
}

async function scheduleWeeklyAlerts(topics: AlertTopicKey[], analytics: Analytics) {
  await clearScheduledAlertNotifications();

  const ids: string[] = [];
  for (const topic of topics) {
    const content = buildNotificationContent(topic, analytics);
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 2,
        hour: 9,
        minute: 0,
      },
    });
    ids.push(id);
  }

  return ids;
}

async function sendImmediateAlertPreview(topics: AlertTopicKey[], analytics: Analytics) {
  for (const topic of topics) {
    await Notifications.scheduleNotificationAsync({
      content: buildNotificationContent(topic, analytics),
      trigger: null,
    });
  }
}

async function clearScheduledAlertNotifications() {
  const storedIds = await AsyncStorage.getItem(ALERT_NOTIFICATION_IDS_KEY);
  if (!storedIds) {
    return;
  }

  const ids = JSON.parse(storedIds) as string[];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  await AsyncStorage.removeItem(ALERT_NOTIFICATION_IDS_KEY);
}

function buildNotificationContent(topic: AlertTopicKey, analytics: Analytics) {
  switch (topic) {
    case 'weeklyCompanies': {
      const top = analytics.topCompanies7[0];
      return {
        title: 'Top WARN company this week',
        body: top ? `${top.label}: ${top.value.toLocaleString()} workers across ${top.notices} notices.` : 'No WARN company movement in the last 7 days.',
      };
    }
    case 'monthlyCompanies': {
      const top = analytics.topCompanies30[0];
      return {
        title: 'Top WARN company this month',
        body: top ? `${top.label}: ${top.value.toLocaleString()} workers across ${top.notices} notices.` : 'No WARN company movement in the last 30 days.',
      };
    }
    case 'weeklyRegions': {
      const top = analytics.topStates7[0] ?? analytics.topStates[0];
      return {
        title: 'Top WARN region',
        body: top ? `${top.label}: ${top.value.toLocaleString()} affected workers.` : 'No regional WARN movement available.',
      };
    }
    case 'monthlyIndustries': {
      const top = analytics.topIndustries30[0] ?? analytics.topIndustries[0];
      return {
        title: 'Top WARN industry',
        body: top ? `${top.label}: ${top.value.toLocaleString()} affected workers.` : 'No industry WARN movement available.',
      };
    }
    case 'weeklyDigest':
      return {
        title: 'Weekly WARN digest',
        body: `${analytics.last7.notices.toLocaleString()} notices, ${analytics.last7.employees.toLocaleString()} workers, ${analytics.stateCount.toLocaleString()} states tracked.`,
      };
  }
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
  if (range === 'recent') {
    return sorted.slice(0, 25);
  }

  if (range === '30d') {
    return filterWithinDays(sorted, 30);
  }

  return sorted;
}

function noticeRangeTitle(range: NoticeRangeKey) {
  if (range === '30d') {
    return 'WARN notices, last 30 days';
  }

  if (range === 'all') {
    return 'WARN notices, all time';
  }

  return 'Recent WARN notices';
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
    .map(([label, group]) => ({
      label,
      value: group.reduce((sum, notice) => sum + notice.employees, 0),
      notices: group.length,
      meta: compactUnique(group.map((notice) => notice.state)).slice(0, 3).join(', '),
    }))
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

function shouldRefreshCache(savedAt: string) {
  const savedTime = new Date(savedAt).getTime();
  return Number.isNaN(savedTime) || Date.now() - savedTime >= CACHE_REFRESH_INTERVAL_MS;
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
  alertIntro: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  topicList: {
    gap: 10,
    marginTop: 14,
  },
  topicRow: {
    alignItems: 'center',
    borderColor: palette.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  topicRowSelected: {
    backgroundColor: palette.redSoft,
    borderColor: '#ffc9bc',
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.faint,
    borderRadius: 6,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  checkboxSelected: {
    backgroundColor: palette.red,
    borderColor: palette.red,
  },
  checkboxText: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  checkboxTextSelected: {
    color: palette.panel,
  },
  topicCopy: {
    flex: 1,
  },
  topicLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  topicDescription: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  alertActions: {
    gap: 10,
    marginTop: 16,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: palette.panel,
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderColor: palette.faint,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  statusText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
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
