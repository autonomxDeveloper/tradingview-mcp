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

export type UiState = {
  symbol: string;
  timeframe: string;
  chartStyle: ChartStyle;
  assetType: 'auto' | 'stock' | 'crypto';
  exchange: string;
  leftOpen: boolean;
  rightOpen: boolean;
  bottomOpen: boolean;
  rightPanel: RightPanel;
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: string) => void;
  setChartStyle: (chartStyle: ChartStyle) => void;
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
  assetType: 'crypto',
  exchange: 'BINANCE',
  leftOpen: true,
  rightOpen: true,
  bottomOpen: false,
  rightPanel: 'research',
  setSymbol: (symbol) => set({ symbol: symbol.trim().toUpperCase() || 'BTCUSDT' }),
  setTimeframe: (timeframe) => set({ timeframe }),
  setChartStyle: (chartStyle) => set({ chartStyle }),
  setAssetType: (assetType) => set({ assetType }),
  setExchange: (exchange) => set({ exchange: exchange.trim().toUpperCase() || 'BINANCE' }),
  toggleLeft: () => set((state) => ({ leftOpen: !state.leftOpen })),
  toggleRight: (panel) => set((state) => ({ rightOpen: panel ? true : !state.rightOpen, rightPanel: panel ?? state.rightPanel })),
  setRightPanel: (panel) => set({ rightPanel: panel, rightOpen: true }),
  toggleBottom: () => set((state) => ({ bottomOpen: !state.bottomOpen })),
}));