/**
 * Analysis Tool Types
 *
 * Comprehensive type definitions for the trading analysis module.
 */

// ─── Core Data Types ──────────────────────────────────────────────────────────

export interface PricePoint {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

export interface TradeRecord {
    id: string;
    symbol: string;
    direction: 'buy' | 'sell' | 'call' | 'put';
    entryPrice: number;
    exitPrice: number;
    entryTime: number;
    exitTime: number;
    contractSize: number;
    profit: number;
    currency?: string;
}

export interface PortfolioAsset {
    symbol: string;
    displayName?: string;
    quantity: number;
    currentPrice: number;
    averageEntryPrice: number;
    currency?: string;
}

// ─── Trading Data Analysis ────────────────────────────────────────────────────

export interface PriceTrendResult {
    symbol: string;
    trend: 'uptrend' | 'downtrend' | 'sideways';
    strength: number; // 0–1
    sma20: number;
    sma50: number;
    ema12: number;
    ema26: number;
    priceChange: number;
    priceChangePercent: number;
}

export interface VolumeAnalysisResult {
    averageVolume: number;
    volumeChange: number;
    volumeChangePercent: number;
    volumeTrend: 'increasing' | 'decreasing' | 'stable';
}

export interface VolatilityResult {
    symbol: string;
    standardDeviation: number;
    averageTrueRange: number;
    historicalVolatility: number; // annualised %
    bollingerBands: {
        upper: number;
        middle: number;
        lower: number;
    };
}

export interface PatternRecognitionResult {
    pattern: string;
    confidence: number; // 0–1
    direction: 'bullish' | 'bearish' | 'neutral';
    description: string;
    detectedAt: number;
}

export interface TradingDataAnalysisResult {
    symbol: string;
    priceTrend: PriceTrendResult;
    volumeAnalysis: VolumeAnalysisResult;
    volatility: VolatilityResult;
    patterns: PatternRecognitionResult[];
    rsi: number;
    macd: { value: number; signal: number; histogram: number };
    analysedAt: number;
}

// ─── Market Analysis ──────────────────────────────────────────────────────────

export type SentimentLevel = 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';

export interface MarketSentimentResult {
    symbol: string;
    sentiment: SentimentLevel;
    score: number; // -1 to +1
    signals: Array<{ name: string; value: number; weight: number }>;
}

export interface PricePrediction {
    symbol: string;
    currentPrice: number;
    predictedPrice: number;
    predictedChange: number;
    predictedChangePercent: number;
    confidence: number; // 0–1
    horizon: 'short' | 'medium' | 'long';
    methodology: string;
}

export interface CorrelationResult {
    symbolA: string;
    symbolB: string;
    correlation: number; // -1 to +1
    interpretation: 'strong_positive' | 'moderate_positive' | 'weak' | 'moderate_negative' | 'strong_negative';
    sampleSize: number;
}

export interface MarketAnalysisResult {
    sentiment: MarketSentimentResult;
    prediction: PricePrediction;
    correlations: CorrelationResult[];
    analysedAt: number;
}

// ─── Portfolio Analysis ───────────────────────────────────────────────────────

export interface PortfolioPerformanceMetrics {
    totalValue: number;
    totalCost: number;
    unrealisedPnL: number;
    unrealisedPnLPercent: number;
    realisedPnL: number;
    totalReturn: number;
    totalReturnPercent: number;
    bestPerformer: string;
    worstPerformer: string;
}

export interface RiskMetrics {
    portfolioBeta: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    valueAtRisk95: number; // VaR at 95% confidence
    valueAtRisk99: number; // VaR at 99% confidence
}

export interface AllocationResult {
    symbol: string;
    displayName?: string;
    currentAllocation: number; // as a fraction (0–1)
    currentAllocationPercent: number;
    suggestedAllocation?: number;
    overweight: boolean;
    underweight: boolean;
}

export interface PortfolioAnalysisResult {
    performance: PortfolioPerformanceMetrics;
    risk: RiskMetrics;
    allocations: AllocationResult[];
    diversificationScore: number; // 0–1
    analysedAt: number;
}

// ─── Financial Metrics ────────────────────────────────────────────────────────

export interface ROIMetrics {
    totalROI: number;
    totalROIPercent: number;
    annualisedROI: number;
    periodDays: number;
}

export interface WinLossMetrics {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number; // 0–1
    lossRate: number; // 0–1
    averageWin: number;
    averageLoss: number;
    profitFactor: number;
    expectancy: number;
}

export interface DrawdownMetrics {
    maxDrawdown: number;
    maxDrawdownPercent: number;
    averageDrawdown: number;
    longestDrawdownPeriodDays: number;
    currentDrawdown: number;
    currentDrawdownPercent: number;
    recoveryFactor: number;
}

export interface FinancialMetricsResult {
    roi: ROIMetrics;
    winLoss: WinLossMetrics;
    drawdown: DrawdownMetrics;
    calculatedAt: number;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'json';

export interface ExportOptions {
    format: ExportFormat;
    filename?: string;
    includeHeaders?: boolean;
}

export interface ExportResult {
    success: boolean;
    filename: string;
    format: ExportFormat;
    recordCount: number;
    exportedAt: number;
    error?: string;
}
