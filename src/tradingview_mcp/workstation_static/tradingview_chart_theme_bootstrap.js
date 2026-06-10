(function() {
  const TV_GREEN = '#089981';
  const TV_RED = '#f23645';
  const TV_BLUE = '#2962ff';
  const TV_GRID = '#eef2f7';
  const TV_AXIS = '#d9e1ec';
  const TV_TEXT = '#5b6472';
  const TV_BG = '#ffffff';

  const originalCreateChart = window.LightweightCharts && window.LightweightCharts.createChart;
  if (!originalCreateChart || window.__tradingViewChartThemeBootstrap) return;
  window.__tradingViewChartThemeBootstrap = true;

  function mergeOptions(options) {
    return {
      ...(options || {}),
      layout: {
        ...(options?.layout || {}),
        background: { color: TV_BG },
        textColor: TV_TEXT,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Segoe UI, sans-serif',
      },
      grid: {
        vertLines: { color: TV_GRID },
        horzLines: { color: TV_GRID },
      },
      crosshair: {
        ...(options?.crosshair || {}),
        vertLine: { color: '#758696', width: 1, style: 3, labelBackgroundColor: TV_BLUE },
        horzLine: { color: '#758696', width: 1, style: 3, labelBackgroundColor: TV_BLUE },
      },
      rightPriceScale: {
        ...(options?.rightPriceScale || {}),
        borderColor: TV_AXIS,
      },
      timeScale: {
        ...(options?.timeScale || {}),
        borderColor: TV_AXIS,
        timeVisible: true,
        secondsVisible: false,
      },
    };
  }

  function patchChart(chart) {
    const originalCandles = chart.addCandlestickSeries?.bind(chart);
    const originalHistogram = chart.addHistogramSeries?.bind(chart);
    const originalLine = chart.addLineSeries?.bind(chart);

    if (originalCandles) {
      chart.addCandlestickSeries = (options = {}) => originalCandles({
        upColor: TV_GREEN,
        downColor: TV_RED,
        borderUpColor: TV_GREEN,
        borderDownColor: TV_RED,
        wickUpColor: TV_GREEN,
        wickDownColor: TV_RED,
        priceLineColor: TV_BLUE,
        lastValueVisible: true,
        priceLineVisible: true,
        ...(options || {}),
      });
    }

    if (originalHistogram) {
      chart.addHistogramSeries = (options = {}) => originalHistogram({
        color: 'rgba(41, 98, 255, 0.24)',
        priceLineVisible: false,
        lastValueVisible: false,
        ...(options || {}),
      });
    }

    if (originalLine) {
      chart.addLineSeries = (options = {}) => originalLine({
        color: options.color || TV_BLUE,
        lineWidth: options.lineWidth || 2,
        ...(options || {}),
      });
    }

    return chart;
  }

  window.LightweightCharts.createChart = function(container, options) {
    return patchChart(originalCreateChart.call(window.LightweightCharts, container, mergeOptions(options)));
  };
})();
