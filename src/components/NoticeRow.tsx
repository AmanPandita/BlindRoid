import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/styles';
import { WarnNotice } from '../types';
import { formatDay, formatMonth } from '../utils/format';
import { CompanyLogo } from './CompanyLogo';

type Props = {
  isExpanded?: boolean;
  logoRefreshKey?: number;
  notice: WarnNotice;
  onToggle?: () => void;
};

export function NoticeRow({ isExpanded = false, logoRefreshKey, notice, onToggle }: Props) {
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
            <Text style={styles.detailValue}>
              {new Date(notice.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={styles.detailValue}>
              {notice.city}, {notice.state}
            </Text>
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
