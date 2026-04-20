import { DAY_MS } from '../constants';
import { Analytics, CompanyRangeKey, NoticeRangeKey, RankedRow, WarnNotice } from '../types';
import { compactUnique } from './company';
import { toTime } from './format';

// ─── Grouping & ranking ────────────────────────────────────────────────────

export function groupBy(
  records: WarnNotice[],
  getKey: (notice: WarnNotice) => string
): Record<string, WarnNotice[]> {
  return records.reduce<Record<string, WarnNotice[]>>((groups, notice) => {
    const key = getKey(notice).trim() || 'Unknown';
    groups[key] = [...(groups[key] ?? []), notice];
    return groups;
  }, {});
}

export function rankGroups(groups: Record<string, WarnNotice[]>): RankedRow[] {
  return Object.entries(groups)
    .map(([label, group]) => ({
      label,
      value: group.reduce((sum, notice) => sum + notice.employees, 0),
      notices: group.length,
      meta: compactUnique(group.map((notice) => notice.state)).slice(0, 3).join(', '),
      ticker: group.find((notice) => notice.ticker)?.ticker,
    }))
    .sort((a, b) => b.value - a.value);
}

export function filterWithinDays(records: WarnNotice[], days: number): WarnNotice[] {
  const cutoff = Date.now() - days * DAY_MS;
  return records.filter((notice) => toTime(notice.date) >= cutoff);
}

function summarize(records: WarnNotice[]) {
  return {
    notices: records.length,
    employees: records.reduce((sum, notice) => sum + notice.employees, 0),
  };
}

// ─── Analytics builder ─────────────────────────────────────────────────────

export function buildAnalytics(notices: WarnNotice[]): Analytics {
  const sorted = [...notices].sort((a, b) => toTime(b.date) - toTime(a.date));
  const totalEmployees = notices.reduce((sum, notice) => sum + notice.employees, 0);
  const last7Notices = filterWithinDays(notices, 7);
  const last30Notices = filterWithinDays(notices, 30);
  const states = groupBy(notices, (n) => n.state || 'NA');
  const industries = groupBy(notices, (n) => n.industry || 'Unclassified');
  const companies = groupBy(notices, (n) => n.company || 'Unknown company');

  return {
    totalNotices: notices.length,
    totalEmployees,
    companyCount: Object.keys(companies).length,
    industryCount: Object.keys(industries).length,
    stateCount: Object.keys(states).length,
    averageImpact: notices.length ? Math.round(totalEmployees / notices.length) : 0,
    last7: summarize(last7Notices),
    last30: summarize(last30Notices),
    topCompanies7: rankGroups(groupBy(last7Notices, (n) => n.company)),
    topCompanies30: rankGroups(groupBy(last30Notices, (n) => n.company)),
    topCompaniesAll: rankGroups(companies),
    topStates7: rankGroups(groupBy(last7Notices, (n) => n.state || 'NA')),
    topStates: rankGroups(states),
    topIndustries7: rankGroups(groupBy(last7Notices, (n) => n.industry || 'Unclassified')),
    topIndustries30: rankGroups(groupBy(last30Notices, (n) => n.industry || 'Unclassified')),
    topIndustries: rankGroups(industries),
    recentNotices: sorted.slice(0, 25),
  };
}

// ─── Range selectors ───────────────────────────────────────────────────────

export function getCompanyRowsForRange(analytics: Analytics, range: CompanyRangeKey): RankedRow[] {
  if (range === '7d') return analytics.topCompanies7;
  if (range === '30d') return analytics.topCompanies30;
  return analytics.topCompaniesAll;
}

export function getRegionRowsForRange(analytics: Analytics, range: CompanyRangeKey): RankedRow[] {
  if (range === '7d') return analytics.topStates7;
  return analytics.topStates;
}

export function getIndustryRowsForRange(analytics: Analytics, range: CompanyRangeKey): RankedRow[] {
  if (range === '7d') return analytics.topIndustries7;
  if (range === '30d') return analytics.topIndustries30;
  return analytics.topIndustries;
}

export function getNoticesForRange(notices: WarnNotice[], range: NoticeRangeKey): WarnNotice[] {
  const sorted = [...notices].sort((a, b) => toTime(b.date) - toTime(a.date));
  if (range === '7d') return filterWithinDays(sorted, 7);
  if (range === '30d') return filterWithinDays(sorted, 30);
  return sorted;
}

// ─── Filters ───────────────────────────────────────────────────────────────

export function filterRankedRows(rows: RankedRow[], query: string): RankedRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => `${row.label} ${row.meta ?? ''}`.toLowerCase().includes(q));
}

export function filterNotices(notices: WarnNotice[], query: string): WarnNotice[] {
  const q = query.trim().toLowerCase();
  if (!q) return notices;
  return notices.filter((notice) =>
    `${notice.company} ${notice.city} ${notice.state} ${notice.industry} ${notice.reason}`
      .toLowerCase()
      .includes(q)
  );
}

// ─── Title helpers ─────────────────────────────────────────────────────────

export function companyRangeTitle(range: CompanyRangeKey): string {
  if (range === '7d') return 'Top companies, last 7 days';
  if (range === '30d') return 'Top companies, last 30 days';
  return 'Top companies, all time';
}

export function noticeRangeTitle(range: NoticeRangeKey): string {
  if (range === '7d') return 'WARN notices, last 7 days';
  if (range === '30d') return 'WARN notices, last 30 days';
  return 'WARN notices, all time';
}

export function getMomentumTitle(range: CompanyRangeKey): string {
  if (range === '7d') return 'Top 5 companies, last 7 days';
  if (range === '30d') return 'Top 5 companies, last 30 days';
  return 'Top 5 companies, all time';
}

export function getRegionsTitle(range: CompanyRangeKey): string {
  if (range === '7d') return 'Top 5 regions, last 7 days';
  if (range === '30d') return 'Top 5 regions, last 30 days';
  return 'Top 5 regions, all time';
}

export function getIndustriesTitle(range: CompanyRangeKey): string {
  if (range === '7d') return 'Top 5 industries, last 7 days';
  if (range === '30d') return 'Top 5 industries, last 30 days';
  return 'Top 5 industries, all time';
}
