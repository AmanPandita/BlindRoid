import { CompanyRangeKey, NoticeRangeKey, WarnNotice } from '../types';

declare const process: {
  env: {
    EXPO_PUBLIC_WARN_FIREHOSE_API_KEY?: string;
    EXPO_PUBLIC_REDDIT_CLIENT_ID?: string;
    EXPO_PUBLIC_REDDIT_CLIENT_SECRET?: string;
  };
};

// API
export const WARN_API_KEY = process.env.EXPO_PUBLIC_WARN_FIREHOSE_API_KEY;
export const WARN_BASE_ENDPOINT = 'https://warnfirehose.com/api/records';
export const PAGE_LIMIT = 25;
export const MAX_API_CALLS = 20;

// Cache keys
export const CACHE_KEY = 'warnfirehose.warn_notices.v1';
export const REDDIT_CACHE_KEY = 'warnfirehose.reddit_posts.v1';
export const REDDIT_LAST_FETCH_KEY = 'warnfirehose.reddit_last_fetch.v1';

// Timing
export const CACHE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const CACHE_REFRESH_CHECK_MS = 60 * 1000; // 1 minute
export const CACHE_REFRESH_HOUR = 7; // 7 AM
export const REDDIT_REFRESH_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
export const DAY_MS = 24 * 60 * 60 * 1000;

// Theme
export const palette = {
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

// Range options
export const companyRanges: { key: CompanyRangeKey; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: 'all', label: 'All' },
];

export const noticeRanges: { key: NoticeRangeKey; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: 'all', label: 'All' },
];

// Known company mappings
export const knownCompanyDomains: Record<string, string> = {
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

export const knownCompanyTickers: Record<string, string> = {
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

// Fallback data shown when API is unavailable
export const sampleNotices: WarnNotice[] = [
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
