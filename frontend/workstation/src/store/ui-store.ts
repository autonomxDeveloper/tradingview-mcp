import { create } from 'zustand';

export type RightPanel = 'research' | 'workflow' | 'paper' | 'journal' | 'indicators' | 'news' | 'layout';

export type ChartStyle =
  | 'bars'
  | 'candles'
  | 'hollow-candles'
  | 'volume-candles'
  | 'line'
  | 'line-with-markers'
  | 'step-line'
  | 'area'
  | 'hlc-area'
  | 'baseline'
  | 'columns'
  | 'high-low'
  | 'volume-footprint'
  | 'time-price-opportunity'
  | 'session-volume-profile'
  | 'heikin-ashi'
  | 'renko'
  | 'line-break';

export type ChartTool =
  | 'cursor'
  | 'crosshair'
  | 'trend-line'
  | 'ray'
  | 'horizontal-line'
  | 'vertical-line'
  | 'parallel-channel'
  | 'fib-retracement'
  | 'brush'
  | 'text'
  | 'emoji'
  | 'measure'
  | 'zoom'
  | 'magnet'
  | 'lock'
  | 'hide-drawings'
  | 'global-mode'
  | 'delete';

export type ThemeMode = 'night' | 'day';

export type UiState = {
  symbol: string;
  timeframe: string;
  chartStyle: ChartStyle;
  activeChartTool: ChartTool;
  drawingsVisible: boolean;
  chartLocked: boolean;
  favoriteChartTools: ChartTool[];
  themeMode: ThemeMode;
  assetType: 'auto' | 'stock' | 'crypto';
  exchange: string;
  leftOpen: boolean;
  rightOpen: boolean;
  bottomOpen: boolean;
  rightPanel: RightPanel;
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: string) => void;
  setChartStyle: (chartStyle: ChartStyle) => void;
  setActiveChartTool: (tool: ChartTool) => void;
  toggleDrawingsVisible: () => void;
  toggleChartLocked: () => void;
  toggleFavoriteChartTool: (tool: ChartTool) => void;
  clearChartTools: () => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  toggleThemeMode: () => void;
  setAssetType: (assetType: UiState['assetType']) => void;
  setExchange: (exchange: string) => void;
  toggleLeft: () => void;
  toggleRight: (panel?: RightPanel) => void;
  setRightPanel: (panel: RightPanel) => void;
  toggleBottom: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  symbol: 'BTCUSDT',
  timeframe: '1D',
  chartStyle: 'candles',
  activeChartTool: 'crosshair',
  drawingsVisible: true,
  chartLocked: false,
  favoriteChartTools: ['crosshair', 'trend-line', 'horizontal-line'],
  themeMode: 'night',
  assetType: 'crypto',
  exchange: 'BINANCE',
  leftOpen: true,
  rightOpen: true,
  bottomOpen: false,
  rightPanel: 'research',
  setSymbol: (symbol) => set({ symbol: symbol.trim().toUpperCase() || 'BTCUSDT' }),
  setTimeframe: (timeframe) => set({ timeframe }),
  setChartStyle: (chartStyle) => set({ chartStyle }),
  setActiveChartTool: (tool) =>
    set((state) => {
      if (tool === 'delete') {
        return { activeChartTool: 'cursor', drawingsVisible: true };
      }
      if (tool === 'hide-drawings') {
        return { activeChartTool: tool, drawingsVisible: !state.drawingsVisible };
      }
      if (tool === 'lock') {
        return { activeChartTool: tool, chartLocked: !state.chartLocked };
      }
      return { activeChartTool: tool };
    }),
  toggleDrawingsVisible: () => set((state) => ({ drawingsVisible: !state.drawingsVisible })),
  toggleChartLocked: () => set((state) => ({ chartLocked: !state.chartLocked })),
  toggleFavoriteChartTool: (tool) =>
    set((state) => ({
      favoriteChartTools: state.favoriteChartTools.includes(tool)
        ? state.favoriteChartTools.filter((item) => item !== tool)
        : [...state.favoriteChartTools, tool],
    })),
  clearChartTools: () => set({ activeChartTool: 'cursor', drawingsVisible: true }),
  setThemeMode: (themeMode) => set({ themeMode }),
  toggleThemeMode: () => set((state) => ({ themeMode: state.themeMode === 'night' ? 'day' : 'night' })),
  setAssetType: (assetType) => set({ assetType }),
  setExchange: (exchange) => set({ exchange: exchange.trim().toUpperCase() || 'BINANCE' }),
  toggleLeft: () => set((state) => ({ leftOpen: !state.leftOpen })),
  toggleRight: (panel) => set((state) => ({ rightOpen: panel ? true : !state.rightOpen, rightPanel: panel ?? state.rightPanel })),
  setRightPanel: (panel) => set({ rightPanel: panel, rightOpen: true }),
  toggleBottom: () => set((state) => ({ bottomOpen: !state.bottomOpen })),
}));
