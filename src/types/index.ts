export type RawWarnRecord = Record<string, unknown>;

export type WarnNotice = {
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

export type CachePayload = {
  savedAt: string;
  notices: WarnNotice[];
};

export type RootTabParamList = {
  Overview: undefined;
  Companies: undefined;
  Regions: undefined;
  Notices: undefined;
  Reddit: undefined;
};

export type RankedRow = {
  label: string;
  value: number;
  notices: number;
  meta?: string;
  ticker?: string;
};

export type CompanyRangeKey = '7d' | '30d' | 'all';
export type NoticeRangeKey = '7d' | '30d' | 'all';

export type StockQuote = {
  currency: string;
  marketState: string;
  price: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: number;
  symbol: string;
};

export type RedditPost = {
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

type AnalyticsSummary = { notices: number; employees: number };

export type Analytics = {
  totalNotices: number;
  totalEmployees: number;
  companyCount: number;
  industryCount: number;
  stateCount: number;
  averageImpact: number;
  last7: AnalyticsSummary;
  last30: AnalyticsSummary;
  topCompanies7: RankedRow[];
  topCompanies30: RankedRow[];
  topCompaniesAll: RankedRow[];
  topStates7: RankedRow[];
  topStates: RankedRow[];
  topIndustries7: RankedRow[];
  topIndustries30: RankedRow[];
  topIndustries: RankedRow[];
  recentNotices: WarnNotice[];
};
