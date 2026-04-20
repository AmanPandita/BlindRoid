/**
 * sync-warnfirehose.ts
 *
 * Fetches up to 5 000 WARN layoff records from warnfirehose.com and upserts
 * them into the Supabase `warn_notices` table.
 *
 * Run daily with:
 *   npx tsx scripts/sync-warnfirehose.ts
 *   -- or --
 *   npm run sync
 *
 * ─── Supabase table setup (run once in the Supabase SQL editor) ─────────────
 *
 * create table if not exists public.warn_notices (
 *   id          text primary key,
 *   company     text not null,
 *   city        text not null default 'Unknown city',
 *   state       text not null default 'NA',
 *   industry    text not null default 'Unclassified',
 *   date        text not null,
 *   employees   integer not null default 0,
 *   reason      text not null default 'WARN notice',
 *   ticker      text,
 *   synced_at   timestamptz not null default now()
 * );
 *
 * -- If RLS is enabled, either disable it or add a policy that allows inserts
 * -- with the service role key.  Use SUPABASE_KEY=<service_role_key> when
 * -- running this script.
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// ── env loading ──────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const raw of content.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch {
    // file not present – silently skip
  }
}

// Load .env.local first (higher priority), then .env
loadEnvFile(resolve(__dirname, '../.env.local'));
loadEnvFile(resolve(__dirname, '../.env'));

// ── config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
const WARN_API_KEY = process.env.WARN_FIREHOSE_SYNC_API_KEY ?? '';

const WARN_BASE = 'https://warnfirehose.com/api/records';
const PAGE_SIZE = 25;      // free tier hard-caps each response at 25 records
const MAX_REQUESTS = 20;   // max API calls per run (20 × 25 = 500 records)
const MAX_RECORDS = PAGE_SIZE * MAX_REQUESTS;
const UPSERT_BATCH = 500;  // rows per Supabase upsert call

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  SUPABASE_URL / SUPABASE_KEY missing. Check .env.local');
  process.exit(1);
}
if (!WARN_API_KEY) {
  console.error('❌  WARN_FIREHOSE_SYNC_API_KEY missing. Check .env.local');
  process.exit(1);
}

// ── types ────────────────────────────────────────────────────────────────────

type RawRecord = Record<string, unknown>;

interface WarnNotice {
  id: string;
  company: string;
  city: string;
  state: string;
  industry: string;
  date: string;
  employees: number;
  reason: string;
  ticker?: string;
  synced_at: string;
}

// ── helpers (mirrors App.tsx normalisation) ──────────────────────────────────

function text(...values: unknown[]): string {
  const value = values.find((v) => typeof v === 'string' || typeof v === 'number');
  return value == null ? '' : String(value).trim();
}

function num(...values: unknown[]): number {
  const value = values.find((v) => Number.isFinite(Number(v)));
  return value == null ? 0 : Number(value);
}

function extractRecords(json: unknown): RawRecord[] {
  if (Array.isArray(json)) return json as RawRecord[];
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    for (const key of ['records', 'data', 'results', 'notices']) {
      if (Array.isArray(obj[key])) return obj[key] as RawRecord[];
    }
  }
  return [];
}

function normalizeNotice(record: RawRecord, index: number): WarnNotice | null {
  const company = text(
    record.company_name, record.company, record.employer, record.name,
  );
  if (!company) return null;

  const date = text(
    record.notice_date, record.date, record.received_date,
    record.effective_date, record.layoff_date,
  );
  const state = text(record.state, record.state_code, record.location_state).toUpperCase();
  const ticker = text(record.ticker) || undefined;

  const rawId = text(record.id, record.record_id, record.notice_id);

  return {
    id: rawId || `${company}-${date}-${index}`,
    company,
    city: text(record.city, record.location_city, record.worksite_city) || 'Unknown city',
    state: state || 'NA',
    industry: text(record.industry, record.naics_industry, record.sector) || 'Unclassified',
    date: date || new Date().toISOString(),
    employees: num(
      record.employees_affected, record.workers_affected,
      record.employees, record.total_layoffs, record.count,
    ),
    reason: text(record.reason, record.closure_type, record.notice_type, record.type) || 'WARN notice',
    ticker,
    synced_at: new Date().toISOString(),
  };
}

// ── fetch from WARNfirehose (paginated) ──────────────────────────────────────

async function fetchAllRecords(): Promise<{ notices: WarnNotice[]; partial: boolean }> {
  console.log(`⬇️  Fetching up to ${MAX_RECORDS} records from WARNfirehose (page size ${PAGE_SIZE})…`);

  const allNotices: WarnNotice[] = [];
  let offset = 0;
  let total: number | null = null;
  let requestCount = 0;

  while (allNotices.length < MAX_RECORDS && requestCount < MAX_REQUESTS) {
    const url = `${WARN_BASE}?limit=${PAGE_SIZE}&offset=${offset}`;
    const response = await fetch(url, {
      headers: {
        'X-API-Key': WARN_API_KEY,
        Accept: 'application/json',
      },
    });

    requestCount++;

    if (response.status === 429) {
      const body = await response.text();
      console.log(`\n⚠️  Rate limit reached after ${allNotices.length} records. Saving what we have.`);
      console.log(`   API message: ${body}`);
      return { notices: allNotices, partial: true };
    }

    if (!response.ok) {
      throw new Error(`WARNfirehose HTTP ${response.status} at offset ${offset}: ${await response.text()}`);
    }

    const json = await response.json();

    // Capture total on first page
    if (total === null) {
      const t = (json as Record<string, unknown>).total;
      total = typeof t === 'number' ? t : null;
    }

    const raw = extractRecords(json);
    if (raw.length === 0) break; // no more data

    const normalized = raw.map(normalizeNotice).filter(Boolean) as WarnNotice[];
    allNotices.push(...normalized);
    offset += raw.length; // advance by actual records returned, not PAGE_SIZE

    process.stdout.write(
      `\r   fetched ${allNotices.length}${total != null ? ` / ${Math.min(total, MAX_RECORDS)}` : ''} records (request ${requestCount}/${MAX_REQUESTS})`,
    );

    // Stop when we've consumed all available records (use API-reported total)
    if (total !== null && offset >= Math.min(total, MAX_RECORDS)) break;
  }

  console.log(`\n   done — ${allNotices.length} normalized notices`);
  return { notices: allNotices.slice(0, MAX_RECORDS), partial: false };
}

// ── upsert to Supabase ───────────────────────────────────────────────────────

async function upsertToSupabase(notices: WarnNotice[]): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  let inserted = 0;

  for (let i = 0; i < notices.length; i += UPSERT_BATCH) {
    const batch = notices.slice(i, i + UPSERT_BATCH);
    // onConflict: 'id' ensures duplicate records are updated in-place, never inserted twice
    const { error } = await supabase
      .from('warn_notices')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      throw new Error(`Supabase upsert failed at offset ${i}: ${error.message}`);
    }

    inserted += batch.length;
    process.stdout.write(`\r⬆️  Upserted ${inserted} / ${notices.length}`);
  }

  console.log('\n✅  Sync complete.');
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { notices, partial } = await fetchAllRecords();

  if (notices.length === 0) {
    console.warn('⚠️  No records returned. Nothing to sync.');
    process.exit(0);
  }

  await upsertToSupabase(notices);

  if (partial) {
    console.log(`ℹ️  Partial sync saved (hit rate limit). ${MAX_REQUESTS} requests × ${PAGE_SIZE} records = ${MAX_RECORDS} max per run.`);
    console.log('   Run again tomorrow to accumulate more records.');
  }
}

main().catch((err) => {
  console.error('❌  Sync failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
