import { useEffect, useState } from 'react';

import { StockQuote } from '../types';

export function useStockQuote(
  ticker: string | undefined,
  enabled: boolean
): { quote: StockQuote | null; failed: boolean } {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || !ticker) return;

    let active = true;

    async function loadQuote() {
      try {
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
          { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } }
        );
        const json = await response.json();
        const result = json?.chart?.result?.[0]?.meta;

        if (!active || !result?.regularMarketPrice) {
          setFailed(true);
          return;
        }

        const price = Number(result.regularMarketPrice);
        const previousClose = Number(result.previousClose);
        const changePercent =
          Number.isFinite(previousClose) && previousClose > 0
            ? ((price - previousClose) / previousClose) * 100
            : undefined;

        setQuote({
          currency: result.currency ?? 'USD',
          marketState: result.marketState ?? '',
          price,
          regularMarketChangePercent: changePercent,
          regularMarketTime: result.regularMarketTime,
          symbol: result.symbol ?? ticker,
        });
      } catch {
        if (active) setFailed(true);
      }
    }

    loadQuote();
    const interval = setInterval(() => {
      if (active) loadQuote();
    }, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [enabled, ticker]);

  return { quote, failed };
}
