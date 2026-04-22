import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/styles';
import { RankedRow } from '../types';
import { formatCurrency } from '../utils/format';
import { guessCompanyTicker } from '../utils/company';
import { useStockQuote } from '../hooks/useStockQuote';
import { CompanyLogo } from './CompanyLogo';

type Props = {
  index: number;
  isExpanded?: boolean;
  logoRefreshKey?: number;
  onToggle?: () => void;
  row: RankedRow;
  showStock?: boolean;
};

export function CompanyRow({
  index,
  isExpanded = false,
  logoRefreshKey,
  onToggle,
  row,
  showStock = false,
}: Props) {
  const ticker = row.ticker || guessCompanyTicker(row.label);
  const { failed, quote } = useStockQuote(ticker, showStock);
  const isUp =
    quote != null &&
    Number.isFinite(quote.regularMarketChangePercent ?? NaN) &&
    (quote.regularMarketChangePercent ?? 0) >= 0;

  return (
    <View>
      <Pressable
        onPress={onToggle}
        style={[styles.companyRow, isExpanded && styles.companyRowExpanded]}
      >
        <View style={styles.logoStack}>
          <CompanyLogo company={row.label} refreshKey={logoRefreshKey} />
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
          {showStock && ticker && !failed && quote && (
            <Text
              style={[styles.stockText, isUp ? styles.stockUp : styles.stockDown]}
              numberOfLines={1}
            >
              {quote.symbol} {formatCurrency(quote.price, quote.currency)}
            </Text>
          )}
        </View>

        {onToggle && (
          <Text style={styles.expandIndicator}>{isExpanded ? '▼' : '▶'}</Text>
        )}
      </Pressable>

      {isExpanded && (
        <CompanyDetails failed={failed} isUp={isUp} quote={quote} row={row} showStock={showStock} ticker={ticker} />
      )}
    </View>
  );
}

function CompanyDetails({
  failed,
  isUp,
  quote,
  row,
  showStock,
  ticker,
}: {
  failed: boolean;
  isUp: boolean;
  quote: ReturnType<typeof useStockQuote>['quote'];
  row: RankedRow;
  showStock: boolean;
  ticker: string;
}) {
  return (
    <View style={styles.companyDetails}>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Company</Text>
        <Text style={styles.detailValue}>{row.label}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Total Notices</Text>
        <Text style={styles.detailValue}>{row.notices.toLocaleString()}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Total Workers Affected</Text>
        <Text style={styles.detailValue}>{row.value.toLocaleString()}</Text>
      </View>
      {row.meta && (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>States</Text>
          <Text style={styles.detailValue}>{row.meta}</Text>
        </View>
      )}
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Average per Notice</Text>
        <Text style={styles.detailValue}>
          {Math.round(row.value / row.notices).toLocaleString()}
        </Text>
      </View>
      {showStock && ticker && !failed && quote && (
        <>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Stock Symbol</Text>
            <Text style={styles.detailValue}>{quote.symbol}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Stock Price</Text>
            <Text style={[styles.detailValue, isUp ? styles.stockUp : styles.stockDown]}>
              {formatCurrency(quote.price, quote.currency)}
              {Number.isFinite(quote.regularMarketChangePercent) &&
                ` (${isUp ? '+' : ''}${quote.regularMarketChangePercent?.toFixed(2)}%)`}
            </Text>
          </View>
          {quote.regularMarketTime && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Price Updated</Text>
              <Text style={styles.detailValue}>
                {new Date(quote.regularMarketTime * 1000).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}
