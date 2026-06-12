import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, type IChartApi, type UTCTimestamp } from 'lightweight-charts';
import { Maximize2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { chartBars, inferAssetType, workstationApi, type Candle } from '@/lib/api';
import { useUiStore, type ChartStyle } from '@/store/ui-store';

type NormalizedCandle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

const chartStyleLabels: Record<ChartStyle, string> = {
  bars: 'Bars',
  candles: 'Candles',
  'hollow-candles': 'Hollow candles',
  'volume-candles': 'Volume candles',
  line: 'Line',
  'line-with-markers': 'Line with markers',
  'step-line': 'Step line',
  area: 'Area',
  'hlc-area': 'HLC area',
  baseline: 'Baseline',
  columns: 'Columns',
  'high-low': 'High-low',
  'volume-footprint': 'Volume footprint',
  'time-price-opportunity': 'Time price opportunity',
  'session-volume-profile': 'Session volume profile',
  'heikin-ashi': 'Heikin Ashi',
  renko: 'Renko',
  'line-break': 'Line break',
};

const candleLikeStyles = new Set<ChartStyle>([
  'candles',
  'hollow-candles',
  'volume-candles',
  'high-low',
  'volume-footprint',
  'time-price-opportunity',
  'session-volume-profile',
  'heikin-ashi',
  'renko',
  'line-break',
]);

function normalizeCandle(candle: Candle, index: number): NormalizedCandle {
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

function lineData(candles: NormalizedCandle[]) {
  return candles.map((item) => ({ time: item.time, value: item.close }));
}

export function ChartWorkspace() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { symbol, timeframe, chartStyle, assetType } = useUiStore();
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

    if (chartStyle === 'bars') {
      const series = chartRef.current.addBarSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
      });
      series.setData(candles);
      chartRef.current.timeScale().fitContent();
      return () => chartRef.current?.removeSeries(series);
    }

    if (chartStyle === 'line' || chartStyle === 'line-with-markers' || chartStyle === 'step-line') {
      const series = chartRef.current.addLineSeries({
        color: '#22d3ee',
        lineWidth: 2,
        lineType: chartStyle === 'step-line' ? 1 : 0,
      });
      series.setData(lineData(candles));
      if (chartStyle === 'line-with-markers') {
        series.setMarkers(
          candles.slice(-24).map((item, index) => ({
            time: item.time,
            position: index % 2 === 0 ? 'belowBar' : 'aboveBar',
            color: index % 2 === 0 ? '#22c55e' : '#ef4444',
            shape: index % 2 === 0 ? 'arrowUp' : 'arrowDown',
          })),
        );
      }
      chartRef.current.timeScale().fitContent();
      return () => chartRef.current?.removeSeries(series);
    }

    if (chartStyle === 'area' || chartStyle === 'hlc-area' || chartStyle === 'baseline') {
      const series = chartRef.current.addAreaSeries({
        lineColor: '#22d3ee',
        topColor: 'rgba(34, 211, 238, 0.32)',
        bottomColor: 'rgba(34, 211, 238, 0.02)',
      });
      series.setData(lineData(candles));
      chartRef.current.timeScale().fitContent();
      return () => chartRef.current?.removeSeries(series);
    }

    if (chartStyle === 'columns') {
      const series = chartRef.current.addHistogramSeries({
        color: '#22d3ee',
        priceFormat: { type: 'price' },
      });
      series.setData(lineData(candles));
      chartRef.current.timeScale().fitContent();
      return () => chartRef.current?.removeSeries(series);
    }

    const series = chartRef.current.addCandlestickSeries({
      upColor: chartStyle === 'hollow-candles' ? 'rgba(34, 197, 94, 0.1)' : '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    series.setData(candles);
    chartRef.current.timeScale().fitContent();
    return () => chartRef.current?.removeSeries(series);
  }, [candles, chartStyle]);

  return (
    <Card data-testid="chart-workspace" className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
      <div data-testid="chart-header" className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div data-testid="chart-title-block">
          <div data-testid="chart-symbol-row" className="flex items-center gap-2 text-lg font-semibold"><span data-testid="chart-symbol-label">{symbol}</span><span data-testid="chart-timeframe-label" className="rounded-full bg-white/10 px-2 py-1 text-xs text-muted-foreground">{timeframe}</span><span data-testid="chart-style-label" className="rounded-full bg-white/10 px-2 py-1 text-xs text-muted-foreground">{chartStyleLabels[chartStyle]}</span></div>
          <div data-testid="chart-route-label" className="text-xs text-muted-foreground">Live research chart · {resolvedAssetType === 'crypto' ? 'Crypto' : 'Stock'} data route</div>
        </div>
        <div data-testid="chart-actions" className="flex items-center gap-2">
          <Button data-testid="chart-indicators-button" variant="terminal" size="sm">Indicators</Button>
          <Button data-testid="fit-chart-button" variant="terminal" size="icon" onClick={() => chartRef.current?.timeScale().fitContent()} aria-label="Fit chart"><Maximize2 size={15} /></Button>
        </div>
      </div>
      <div data-testid="chart-body" className="relative min-h-0 flex-1">
        {chartQuery.isLoading && <div data-testid="chart-loading-state" className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">Loading chart data...</div>}
        {chartQuery.error && <div data-testid="chart-error-state" className="absolute inset-0 z-10 grid place-items-center text-sm text-destructive">{String(chartQuery.error)}</div>}
        {!chartQuery.isLoading && !chartQuery.error && candles.length === 0 && <div data-testid="chart-empty-state" className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">No chart bars returned for this symbol/timeframe.</div>}
        {!chartQuery.isLoading && !chartQuery.error && candleLikeStyles.has(chartStyle) && chartStyle !== 'candles' && chartStyle !== 'hollow-candles' && (
          <div data-testid="chart-style-fallback-note" className="absolute left-4 top-4 z-10 rounded-full border border-white/10 bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            Rendering {chartStyleLabels[chartStyle]} with candlestick geometry.
          </div>
        )}
        <div data-testid="chart-canvas-container" ref={containerRef} className="h-full w-full" />
      </div>
    </Card>
  );
}