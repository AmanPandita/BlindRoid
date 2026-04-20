import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette } from '../constants';
import { styles } from '../styles/styles';
import { Header } from './Header';

type Props = {
  children: ReactNode;
  error: string | null;
  loading: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
};

export function ScreenShell({
  children,
  error,
  loading,
  onRefresh,
  onSearchChange,
  refreshing,
  searchPlaceholder,
  searchValue,
}: Props) {
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 18 }]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              colors={[palette.red]}
              onRefresh={onRefresh}
              refreshing={refreshing || false}
              tintColor={palette.red}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        <Header
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          searchValue={searchValue}
        />
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
