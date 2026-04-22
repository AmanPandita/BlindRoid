import {
  CACHE_REFRESH_HOUR,
  CACHE_REFRESH_INTERVAL_MS,
  MAX_API_CALLS,
  PAGE_LIMIT,
  WARN_API_KEY,
  WARN_BASE_ENDPOINT,
} from '../constants';
import { RawWarnRecord, WarnNotice } from '../types';

// ─── Primitive coercions ───────────────────────────────────────────────────

function text(...values: unknown[]): string {
  const value = values.find((item) => typeof item === 'string' || typeof item === 'number');
  return value === undefined || value === null ? '' : String(value).trim();
}

function number(...values: unknown[]): number {
  const value = values.find((item) => Number.isFinite(Number(item)));
  return value === undefined || value === null ? 0 : Number(value);
}

// ─── Record extraction & normalization ────────────────────────────────────

export function extractRecords(json: unknown): RawWarnRecord[] {
  if (Array.isArray(json)) return json as RawWarnRecord[];

  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    for (const key of ['records', 'data', 'results', 'notices']) {
      if (Array.isArray(obj[key])) return obj[key] as RawWarnRecord[];
    }
  }

  return [];
}

export function normalizeNotice(record: RawWarnRecord, index: number): WarnNotice | null {
  const company = text(record.company_name, record.company, record.employer, record.name);
  if (!company) return null;

  const date = text(
    record.notice_date,
    record.date,
    record.received_date,
    record.effective_date,
    record.layoff_date
  );
  const state = text(record.state, record.state_code, record.location_state).toUpperCase();
  const ticker = text(record.ticker);

  return {
    id: text(record.id, record.record_id, record.notice_id) || `${company}-${date}-${index}`,
    company,
    city: text(record.city, record.location_city, record.worksite_city) || 'Unknown city',
    state: state || 'NA',
    industry: text(record.industry, record.naics_industry, record.sector) || 'Unclassified',
    date: date || new Date().toISOString(),
    employees: number(
      record.employees_affected,
      record.workers_affected,
      record.employees,
      record.total_layoffs,
      record.count
    ),
    reason: text(record.reason, record.closure_type, record.notice_type, record.type) || 'WARN notice',
    ticker: ticker || undefined,
  };
}

// ─── API fetch ─────────────────────────────────────────────────────────────

async function fetchPage(offset: number): Promise<{ total: number; records: WarnNotice[] }> {
  const response = await fetch(`${WARN_BASE_ENDPOINT}?limit=${PAGE_LIMIT}&offset=${offset}`, {
    headers: { 'X-API-Key': WARN_API_KEY!, Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      offset === 0
        ? `WARN Firehose returned ${response.status}`
        : `WARN Firehose returned ${response.status} at offset ${offset}`
    );
  }

  const json = await response.json();
  const records = extractRecords(json).map(normalizeNotice).filter(Boolean) as WarnNotice[];
  return { total: json.total || 0, records };
}

export async function fetchWarnNotices(): Promise<WarnNotice[]> {
  if (!WARN_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_WARN_FIREHOSE_API_KEY in .env');
  }

  const { total, records: firstRecords } = await fetchPage(0);
  let allRecords = firstRecords;
  let offset = PAGE_LIMIT;
  let apiCallCount = 1;

  while (offset < total && apiCallCount < MAX_API_CALLS) {
    const { records } = await fetchPage(offset);
    allRecords = [...allRecords, ...records];
    offset += PAGE_LIMIT;
    apiCallCount++;
  }

  if (!allRecords.length) {
    throw new Error('No WARN notices were returned by the API');
  }

  return allRecords;
}

// ─── Cache invalidation ───────────────────────────────────────────────────

export function shouldRefreshCache(savedAt: string): boolean {
  const savedTime = new Date(savedAt).getTime();
  if (Number.isNaN(savedTime)) return true;

  const now = new Date();
  const timeSinceSave = now.getTime() - savedTime;

  if (timeSinceSave < CACHE_REFRESH_INTERVAL_MS) return false;

  const todayAt7AM = new Date();
  todayAt7AM.setHours(CACHE_REFRESH_HOUR, 0, 0, 0);

  return now.getTime() >= todayAt7AM.getTime() && savedTime < todayAt7AM.getTime();
}
