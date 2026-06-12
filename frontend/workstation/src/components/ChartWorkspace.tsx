import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, type IChartApi, type UTCTimestamp } from 'lightweight-charts';
import { Maximize2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { chartBars, inferAssetType, workstationApi, type Candle } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';

function normalizeCandle(candle: Candle, index: number) {
  const rawTime = candle.time ?? candle.timestamp ?? candle.open_time;
  const parsed = typeof rawTime === 'number' ? rawTime : Date.parse(String(rawTime ?? '')) / 1000;
  const epochSeconds = Number.isFinite(parsed)
    ? parsed
    : Math.floor(Date.now() / 1000) - (300 - index) * 86_400;

  return {
    time: (epochSeconds > 10_000_000_000 ? Math.floor(epochSeconds / 1000) : Math.floor(epochSeconds)) as UTCTimestamp,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
  };
}

export function ChartWorkspace() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { symbol, timeframe, assetType } = useUiStore();
  const resolvedAssetType = inferAssetType(symbol, assetType);
  const chartQuery = useQuery({
    queryKey: ['chart', symbol, timeframe, resolvedAssetType],
    queryFn: () => workstationApi.chart(symbol, timeframe, assetType, 300),
  });

  const candles = useMemo(() => {
    return chartBars(chartQuery.data)
      .map(normalizeCandle)
      .filter((item) => Number.isFinite(item.open + item.high + item.low + item.close));
  }, [chartQuery.data]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: '#cbd5e1' },
      grid: { vertLines: { color: 'rgba(148, 163, 184, 0.08)' }, horzLines: { color: 'rgba(148, 163, 184, 0.08)' } },
      rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.12)' },
      timeScale: { borderColor: 'rgba(148, 163, 184, 0.12)' },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;
    return () => chart.remove();
  }, []);

  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;
    const series = chartRef.current.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    series.setData(candles);
    chartRef.current.timeScale().fitContent();
    return () => chartRef.current?.removeSeries(series);
  }, [candles]);

  return (
    <Card className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold"><span>{symbol}</span><span className="rounded-full bg-white/10 px-2 py-1 text-xs text-muted-foreground">{timeframe}</span></div>
          <div className="text-xs text-muted-foreground">Live research chart · {resolvedAssetType === 'crypto' ? 'Crypto' : 'Stock'} data route</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="terminal" size="sm">Indicators</Button>
          <Button variant="terminal" size="icon" onClick={() => chartRef.current?.timeScale().fitContent()} aria-label="Fit chart"><Maximize2 size={15} /></Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        {chartQuery.isLoading && <div className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">Loading chart data...</div>}
        {chartQuery.error && <div className="absolute inset-0 z-10 grid place-items-center text-sm text-destructive">{String(chartQuery.error)}</div>}
        {!chartQuery.isLoading && !chartQuery.error && candles.length === 0 && <div className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">No chart bars returned for this symbol/timeframe.</div>}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </Card>
  );
}
