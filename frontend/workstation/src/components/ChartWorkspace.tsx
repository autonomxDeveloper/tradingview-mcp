import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createChart, type IChartApi, type UTCTimestamp } from 'lightweight-charts';
import { Eye, EyeOff, Lock, Maximize2, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { chartBars, inferAssetType, workstationApi, type Candle } from '@/lib/api';
import { useUiStore, type ChartStyle, type ChartTool, type ThemeMode } from '@/store/ui-store';

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

const toolLabels: Record<ChartTool, string> = {
  cursor: 'Cursor',
  crosshair: 'Crosshair',
  'trend-line': 'Trend line',
  ray: 'Ray',
  'horizontal-line': 'Horizontal line',
  'vertical-line': 'Vertical line',
  'parallel-channel': 'Parallel channel',
  'fib-retracement': 'Fib retracement',
  brush: 'Brush',
  text: 'Text',
  emoji: 'Emoji',
  measure: 'Measure',
  zoom: 'Zoom',
  magnet: 'Magnet',
  lock: 'Lock drawings',
  'hide-drawings': 'Show/hide drawings',
  'global-mode': 'Global drawing mode',
  delete: 'Delete drawings',
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

const overlayTools = new Set<ChartTool>([
  'trend-line',
  'ray',
  'horizontal-line',
  'vertical-line',
  'parallel-channel',
  'fib-retracement',
  'brush',
  'text',
  'emoji',
  'measure',
]);

function chartPalette(themeMode: ThemeMode) {
  const isDay = themeMode === 'day';
  return {
    text: isDay ? '#334155' : '#cbd5e1',
    grid: isDay ? 'rgba(100, 116, 139, 0.16)' : 'rgba(148, 163, 184, 0.08)',
    border: isDay ? 'rgba(100, 116, 139, 0.24)' : 'rgba(148, 163, 184, 0.12)',
    up: isDay ? '#16a34a' : '#22c55e',
    down: isDay ? '#dc2626' : '#ef4444',
    line: isDay ? '#0284c7' : '#22d3ee',
    areaTop: isDay ? 'rgba(2, 132, 199, 0.22)' : 'rgba(34, 211, 238, 0.32)',
    areaBottom: isDay ? 'rgba(2, 132, 199, 0.02)' : 'rgba(34, 211, 238, 0.02)',
    hollowUp: isDay ? 'rgba(22, 163, 74, 0.08)' : 'rgba(34, 197, 94, 0.1)',
  };
}

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

function ToolOverlay({ activeChartTool, drawingsVisible }: { activeChartTool: ChartTool; drawingsVisible: boolean }) {
  if (!drawingsVisible || !overlayTools.has(activeChartTool)) return null;

  return (
    <div data-testid="chart-tool-overlay" className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {(activeChartTool === 'trend-line' || activeChartTool === 'ray') && (
        <div data-testid={`chart-tool-overlay-${activeChartTool}`} className="absolute left-[16%] top-[62%] h-px w-[64%] -rotate-12 bg-primary/80 shadow-[0_0_18px_rgba(20,184,166,0.45)]" />
      )}
      {activeChartTool === 'horizontal-line' && (
        <div data-testid="chart-tool-overlay-horizontal-line" className="absolute left-0 top-1/2 h-px w-full border-t border-dashed border-primary/80" />
      )}
      {activeChartTool === 'vertical-line' && (
        <div data-testid="chart-tool-overlay-vertical-line" className="absolute left-1/2 top-0 h-full w-px border-l border-dashed border-primary/80" />
      )}
      {activeChartTool === 'parallel-channel' && (
        <div data-testid="chart-tool-overlay-parallel-channel" className="absolute left-[18%] top-[40%] h-24 w-[58%] -rotate-12 border-y border-primary/70 bg-primary/5" />
      )}
      {activeChartTool === 'fib-retracement' && (
        <div data-testid="chart-tool-overlay-fib-retracement" className="absolute inset-x-[12%] top-[28%] space-y-8 text-[10px] text-primary/80">
          {['0.236', '0.382', '0.500', '0.618', '0.786'].map((level) => (
            <div key={level} className="border-t border-dashed border-primary/50 pt-1">{level}</div>
          ))}
        </div>
      )}
      {activeChartTool === 'brush' && (
        <div data-testid="chart-tool-overlay-brush" className="absolute left-[24%] top-[32%] h-28 w-44 rounded-[50%] border-2 border-dashed border-primary/70" />
      )}
      {activeChartTool === 'text' && (
        <div data-testid="chart-tool-overlay-text" className="absolute left-[18%] top-[24%] rounded-xl border border-primary/40 bg-background/80 px-3 py-2 text-xs font-semibold text-primary backdrop-blur">Chart note</div>
      )}
      {activeChartTool === 'emoji' && (
        <div data-testid="chart-tool-overlay-emoji" className="absolute left-[42%] top-[30%] text-3xl">🚀</div>
      )}
      {activeChartTool === 'measure' && (
        <div data-testid="chart-tool-overlay-measure" className="absolute left-[20%] top-[34%] h-32 w-[42%] border border-dashed border-primary/70 bg-primary/5">
          <div className="absolute -top-7 left-0 rounded-full bg-background/90 px-3 py-1 text-xs text-primary">Measure · price/time range</div>
        </div>
      )}
    </div>
  );
}

export function ChartWorkspace() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const {
    symbol,
    timeframe,
    chartStyle,
    activeChartTool,
    drawingsVisible,
    chartLocked,
    themeMode,
    assetType,
    exchange,
    setSymbol,
    setExchange,
    toggleDrawingsVisible,
    toggleChartLocked,
  } = useUiStore();
  const palette = chartPalette(themeMode);
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
      layout: { background: { color: 'transparent' }, textColor: palette.text },
      grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } },
      rightPriceScale: { borderColor: palette.border },
      timeScale: { borderColor: palette.border },
      crosshair: { mode: activeChartTool === 'cursor' ? 0 : 1 },
    });
    chartRef.current = chart;
    return () => chart.remove();
  }, [themeMode]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: { background: { color: 'transparent' }, textColor: palette.text },
      grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } },
      rightPriceScale: { borderColor: palette.border },
      timeScale: { borderColor: palette.border },
      crosshair: { mode: activeChartTool === 'cursor' ? 0 : 1 },
      handleScroll: activeChartTool !== 'lock' && !chartLocked,
      handleScale: activeChartTool !== 'lock' && !chartLocked,
    });
  }, [activeChartTool, chartLocked, themeMode, palette.text, palette.grid, palette.border]);

  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    if (chartStyle === 'bars') {
      const series = chartRef.current.addBarSeries({
        upColor: palette.up,
        downColor: palette.down,
      });
      series.setData(candles);
      chartRef.current.timeScale().fitContent();
      return () => chartRef.current?.removeSeries(series);
    }

    if (chartStyle === 'line' || chartStyle === 'line-with-markers' || chartStyle === 'step-line') {
      const series = chartRef.current.addLineSeries({
        color: palette.line,
        lineWidth: 2,
        lineType: chartStyle === 'step-line' ? 1 : 0,
      });
      series.setData(lineData(candles));
      if (chartStyle === 'line-with-markers') {
        series.setMarkers(
          candles.slice(-24).map((item, index) => ({
            time: item.time,
            position: index % 2 === 0 ? 'belowBar' : 'aboveBar',
            color: index % 2 === 0 ? palette.up : palette.down,
            shape: index % 2 === 0 ? 'arrowUp' : 'arrowDown',
          })),
        );
      }
      chartRef.current.timeScale().fitContent();
      return () => chartRef.current?.removeSeries(series);
    }

    if (chartStyle === 'area' || chartStyle === 'hlc-area' || chartStyle === 'baseline') {
      const series = chartRef.current.addAreaSeries({
        lineColor: palette.line,
        topColor: palette.areaTop,
        bottomColor: palette.areaBottom,
      });
      series.setData(lineData(candles));
      chartRef.current.timeScale().fitContent();
      return () => chartRef.current?.removeSeries(series);
    }

    if (chartStyle === 'columns') {
      const series = chartRef.current.addHistogramSeries({
        color: palette.line,
        priceFormat: { type: 'price' },
      });
      series.setData(lineData(candles));
      chartRef.current.timeScale().fitContent();
      return () => chartRef.current?.removeSeries(series);
    }

    const series = chartRef.current.addCandlestickSeries({
      upColor: chartStyle === 'hollow-candles' ? palette.hollowUp : palette.up,
      downColor: palette.down,
      borderUpColor: palette.up,
      borderDownColor: palette.down,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
    });
    series.setData(candles);
    chartRef.current.timeScale().fitContent();
    return () => chartRef.current?.removeSeries(series);
  }, [candles, chartStyle, themeMode, palette.up, palette.down, palette.line, palette.areaTop, palette.areaBottom, palette.hollowUp]);

  return (
    <Card data-testid="chart-workspace" className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl">
      <div data-testid="chart-header" className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 theme-day:border-slate-200">
        <div data-testid="chart-symbol-search-row" className="flex min-w-0 flex-1 items-center gap-3">
          <div data-testid="chart-symbol-search-control" className="flex min-w-[220px] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 theme-day:border-slate-200 theme-day:bg-white">
            <Search size={16} className="text-muted-foreground" />
            <input data-testid="symbol-input" aria-label="Symbol" className="w-28 bg-transparent text-sm font-semibold outline-none" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
            <span data-testid="symbol-exchange-separator" className="h-5 w-px bg-white/10 theme-day:bg-slate-200" />
            <input data-testid="exchange-input" aria-label="Exchange" className="w-24 bg-transparent text-xs uppercase text-muted-foreground outline-none" value={exchange} onChange={(event) => setExchange(event.target.value)} />
          </div>
          <div data-testid="chart-title-block" className="min-w-0">
            <div data-testid="chart-symbol-row" className="flex flex-wrap items-center gap-2 text-lg font-semibold">
              <span data-testid="chart-symbol-label">{symbol}</span>
              <span data-testid="chart-timeframe-label" className="rounded-full bg-white/10 px-2 py-1 text-xs text-muted-foreground theme-day:bg-slate-100">{timeframe}</span>
              <span data-testid="chart-style-label" className="rounded-full bg-white/10 px-2 py-1 text-xs text-muted-foreground theme-day:bg-slate-100">{chartStyleLabels[chartStyle]}</span>
              <span data-testid="chart-active-tool-pill" className="rounded-full bg-primary/15 px-2 py-1 text-xs text-primary">{toolLabels[activeChartTool]}</span>
            </div>
            <div data-testid="chart-route-label" className="text-xs text-muted-foreground">Live research chart · {resolvedAssetType === 'crypto' ? 'Crypto' : 'Stock'} data route · {themeMode === 'day' ? 'Day' : 'Night'} mode</div>
          </div>
        </div>
        <div data-testid="chart-actions" className="flex items-center gap-2">
          <Button data-testid="chart-toggle-drawings-button" variant="terminal" size="icon" onClick={toggleDrawingsVisible} aria-label="Toggle drawings visibility">
            {drawingsVisible ? <Eye size={15} /> : <EyeOff size={15} />}
          </Button>
          <Button data-testid="chart-lock-button" variant={chartLocked ? 'default' : 'terminal'} size="icon" onClick={toggleChartLocked} aria-label="Lock chart interactions"><Lock size={15} /></Button>
          <Button data-testid="chart-indicators-button" variant="terminal" size="sm">Indicators</Button>
          <Button data-testid="fit-chart-button" variant="terminal" size="icon" onClick={() => chartRef.current?.timeScale().fitContent()} aria-label="Fit chart"><Maximize2 size={15} /></Button>
        </div>
      </div>
      <div data-testid="chart-body" className="relative min-h-0 flex-1">
        {chartQuery.isLoading && <div data-testid="chart-loading-state" className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">Loading chart data...</div>}
        {chartQuery.error && <div data-testid="chart-error-state" className="absolute inset-0 z-10 grid place-items-center text-sm text-destructive">{String(chartQuery.error)}</div>}
        {!chartQuery.isLoading && !chartQuery.error && candles.length === 0 && <div data-testid="chart-empty-state" className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">No chart bars returned for this symbol/timeframe.</div>}
        {!chartQuery.isLoading && !chartQuery.error && candleLikeStyles.has(chartStyle) && chartStyle !== 'candles' && chartStyle !== 'hollow-candles' && (
          <div data-testid="chart-style-fallback-note" className="absolute left-4 top-4 z-10 rounded-full border border-white/10 bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur theme-day:border-slate-200">
            Rendering {chartStyleLabels[chartStyle]} with candlestick geometry.
          </div>
        )}
        {chartLocked && (
          <div data-testid="chart-locked-note" className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur theme-day:border-slate-200">
            Chart locked
          </div>
        )}
        <ToolOverlay activeChartTool={activeChartTool} drawingsVisible={drawingsVisible} />
        <div data-testid="chart-canvas-container" ref={containerRef} className="h-full w-full" />
      </div>
    </Card>
  );
}
