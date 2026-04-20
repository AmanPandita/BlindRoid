export function toTime(date: string): number {
  const parsed = new Date(date).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatUpdateTime(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    currency: currency || 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

export function formatMonth(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? 'NA'
    : new Intl.DateTimeFormat('en-US', { month: 'short' }).format(parsed);
}

export function formatDay(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? '--'
    : new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(parsed);
}

export function formatRedditDate(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected WARN Firehose error';
}
