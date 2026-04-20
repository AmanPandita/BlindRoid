import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '../constants';
import { styles } from '../styles/styles';
import { Analytics, RootTabParamList, WarnNotice } from '../types';
import { TabGlyph } from '../components/TabGlyph';
import { CompaniesScreenWrapper } from '../screens/CompaniesScreen';
import { NoticesScreenWrapper } from '../screens/NoticesScreen';
import { OverviewScreenWrapper } from '../screens/OverviewScreen';
import { RedditScreenWrapper } from '../screens/RedditScreen';
import { RegionsScreenWrapper } from '../screens/RegionsScreen';

export const navigationRef = createNavigationContainerRef<RootTabParamList>();

const Tab = createBottomTabNavigator<RootTabParamList>();

type Props = {
  analytics: Analytics;
  error: string | null;
  lastUpdatedAt: string | null;
  loading: boolean;
  notices: WarnNotice[];
  totalCount: number;
};

export function AppTabs({ analytics, error, lastUpdatedAt, loading, notices, totalCount }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: palette.page },
        tabBarActiveTintColor: palette.red,
        tabBarInactiveTintColor: palette.muted,
        tabBarIconStyle: styles.navigatorIconSlot,
        tabBarItemStyle: styles.navigatorItem,
        tabBarLabelStyle: styles.navigatorLabel,
        tabBarStyle: [
          styles.navigatorBar,
          { height: 48 + insets.bottom, paddingBottom: insets.bottom },
        ],
        tabBarIcon: ({ color, focused }) => (
          <TabGlyph color={color} focused={focused} name={route.name as keyof RootTabParamList} />
        ),
      })}
    >
      <Tab.Screen name="Overview">
        {() => (
          <OverviewScreenWrapper
            analytics={analytics}
            error={error}
            lastUpdatedAt={lastUpdatedAt}
            loading={loading}
            notices={notices}
            totalCount={totalCount}
          />
        )}
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
