/**
 * Trading Data Analysis Service
 *
 * Provides historical price and trend analysis, volume and volatility
 * calculations, and pattern recognition for trading symbols.
 */

import type {
    PatternRecognitionResult,
    PricePoint,
    PriceTrendResult,
    TradingDataAnalysisResult,
    VolatilityResult,
    VolumeAnalysisResult,
} from '../../types/analysis.types';

export class TradingDataAnalysisService {
    private static instance: TradingDataAnalysisService;

    private constructor() {}

    public static getInstance(): TradingDataAnalysisService {
        if (!TradingDataAnalysisService.instance) {
            TradingDataAnalysisService.instance = new TradingDataAnalysisService();
        }
        return TradingDataAnalysisService.instance;
    }

    // ─── Moving Averages ──────────────────────────────────────────────────────

    /**
     * Calculate Simple Moving Average over the last `period` close prices.
     */
    public calculateSMA(prices: PricePoint[], period: number): number {
        if (!prices || prices.length < period) return 0;
        const slice = prices.slice(-period);
        return slice.reduce((sum, p) => sum + p.close, 0) / period;
    }

    /**
     * Calculate Exponential Moving Average.
     */
    public calculateEMA(prices: PricePoint[], period: number): number {
        if (!prices || prices.length === 0) return 0;
        const k = 2 / (period + 1);
        let ema = prices[0].close;
        for (let i = 1; i < prices.length; i++) {
            ema = prices[i].close * k + ema * (1 - k);
        }
        return ema;
    }

    // ─── Trend Analysis ───────────────────────────────────────────────────────

    /**
     * Analyse the price trend for a symbol.
     */
    public analysePriceTrend(symbol: string, prices: PricePoint[]): PriceTrendResult {
        if (!prices || prices.length < 2) {
            return {
                symbol,
                trend: 'sideways',
                strength: 0,
                sma20: 0,
                sma50: 0,
                ema12: 0,
                ema26: 0,
                priceChange: 0,
                priceChangePercent: 0,
            };
        }

        const sma20 = this.calculateSMA(prices, Math.min(20, prices.length));
        const sma50 = this.calculateSMA(prices, Math.min(50, prices.length));
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);

        const first = prices[0].close;
        const last = prices[prices.length - 1].close;
        const priceChange = last - first;
        const priceChangePercent = first !== 0 ? (priceChange / first) * 100 : 0;

        let trend: PriceTrendResult['trend'] = 'sideways';
        let strength = 0;

        if (sma20 > sma50 && ema12 > ema26) {
            trend = 'uptrend';
            strength = Math.min(1, Math.abs(priceChangePercent) / 10);
        } else if (sma20 < sma50 && ema12 < ema26) {
            trend = 'downtrend';
            strength = Math.min(1, Math.abs(priceChangePercent) / 10);
        } else {
            trend = 'sideways';
            strength = 0.2;
        }

        return { symbol, trend, strength, sma20, sma50, ema12, ema26, priceChange, priceChangePercent };
    }

    // ─── Volume Analysis ──────────────────────────────────────────────────────

    /**
     * Analyse trading volume trends.
     */
    public analyseVolume(prices: PricePoint[]): VolumeAnalysisResult {
        const volumes = prices.filter(p => p.volume != null).map(p => p.volume as number);
        if (volumes.length < 2) {
            return { averageVolume: 0, volumeChange: 0, volumeChangePercent: 0, volumeTrend: 'stable' };
        }

        const averageVolume = volumes.reduce((s, v) => s + v, 0) / volumes.length;
        const recentAvg = volumes.slice(-Math.min(5, volumes.length)).reduce((s, v) => s + v, 0) / Math.min(5, volumes.length);
        const volumeChange = recentAvg - averageVolume;
        const volumeChangePercent = averageVolume !== 0 ? (volumeChange / averageVolume) * 100 : 0;

        let volumeTrend: VolumeAnalysisResult['volumeTrend'] = 'stable';
        if (volumeChangePercent > 10) volumeTrend = 'increasing';
        else if (volumeChangePercent < -10) volumeTrend = 'decreasing';

        return { averageVolume, volumeChange, volumeChangePercent, volumeTrend };
    }

    // ─── Volatility ───────────────────────────────────────────────────────────

    /**
     * Calculate volatility metrics including ATR and Bollinger Bands.
     */
    public calculateVolatility(symbol: string, prices: PricePoint[]): VolatilityResult {
        if (!prices || prices.length < 2) {
            return {
                symbol,
                standardDeviation: 0,
                averageTrueRange: 0,
                historicalVolatility: 0,
                bollingerBands: { upper: 0, middle: 0, lower: 0 },
            };
        }

        // Standard deviation of close prices
        const closes = prices.map(p => p.close);
        const mean = closes.reduce((s, c) => s + c, 0) / closes.length;
        const variance = closes.reduce((s, c) => s + (c - mean) ** 2, 0) / closes.length;
        const standardDeviation = Math.sqrt(variance);

        // Average True Range
        const trueRanges: number[] = [];
        for (let i = 1; i < prices.length; i++) {
            const highLow = prices[i].high - prices[i].low;
            const highClose = Math.abs(prices[i].high - prices[i - 1].close);
            const lowClose = Math.abs(prices[i].low - prices[i - 1].close);
            trueRanges.push(Math.max(highLow, highClose, lowClose));
        }
        const averageTrueRange = trueRanges.length > 0
            ? trueRanges.reduce((s, v) => s + v, 0) / trueRanges.length
            : 0;

        // Historical volatility (annualised, assuming daily data)
        const returns: number[] = [];
        for (let i = 1; i < closes.length; i++) {
            if (closes[i - 1] !== 0) returns.push(Math.log(closes[i] / closes[i - 1]));
        }
        const retMean = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0;
        const retVariance = returns.length > 0 ? returns.reduce((s, r) => s + (r - retMean) ** 2, 0) / returns.length : 0;
        const historicalVolatility = Math.sqrt(retVariance) * Math.sqrt(252) * 100;

        // Bollinger Bands (20-period)
        const bbPeriod = Math.min(20, prices.length);
        const bbSlice = prices.slice(-bbPeriod);
        const bbMean = bbSlice.reduce((s, p) => s + p.close, 0) / bbPeriod;
        const bbStdDev = Math.sqrt(bbSlice.reduce((s, p) => s + (p.close - bbMean) ** 2, 0) / bbPeriod);
        const bollingerBands = { upper: bbMean + 2 * bbStdDev, middle: bbMean, lower: bbMean - 2 * bbStdDev };

        return { symbol, standardDeviation, averageTrueRange, historicalVolatility, bollingerBands };
    }

    // ─── RSI ──────────────────────────────────────────────────────────────────

    /**
     * Calculate the Relative Strength Index (14-period).
     */
    public calculateRSI(prices: PricePoint[], period = 14): number {
        if (!prices || prices.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            const delta = prices[i].close - prices[i - 1].close;
            if (delta > 0) gains += delta;
            else losses += Math.abs(delta);
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - 100 / (1 + rs);
    }

    // ─── MACD ─────────────────────────────────────────────────────────────────

    /**
     * Calculate Moving Average Convergence/Divergence.
     */
    public calculateMACD(prices: PricePoint[]): { value: number; signal: number; histogram: number } {
        if (!prices || prices.length < 26) return { value: 0, signal: 0, histogram: 0 };

        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        const value = ema12 - ema26;

        // Signal is a 9-period EMA of MACD values
        // Approximate by computing MACD at each step using last 35 data points
        const macdSeries: PricePoint[] = prices.slice(-35).map((p, i, arr) => {
            const slice = arr.slice(0, i + 1);
            const e12 = this.calculateEMA(slice, 12);
            const e26 = this.calculateEMA(slice, 26);
            return { ...p, close: e12 - e26 };
        });

        const signal = this.calculateEMA(macdSeries, 9);
        const histogram = value - signal;

        return { value, signal, histogram };
    }

    // ─── Pattern Recognition ──────────────────────────────────────────────────

    /**
     * Recognise common candlestick patterns in price data.
     */
    public recognisePatterns(prices: PricePoint[]): PatternRecognitionResult[] {
        const results: PatternRecognitionResult[] = [];
        if (!prices || prices.length < 3) return results;

        const last = prices[prices.length - 1];
        const prev = prices[prices.length - 2];
        const prev2 = prices[prices.length - 3];
        const now = last.timestamp;

        const bodySize = (p: PricePoint) => Math.abs(p.close - p.open);
        const fullRange = (p: PricePoint) => p.high - p.low;
        const isBullish = (p: PricePoint) => p.close > p.open;
        const isBearish = (p: PricePoint) => p.close < p.open;

        // Doji
        if (fullRange(last) > 0 && bodySize(last) / fullRange(last) < 0.1) {
            results.push({
                pattern: 'Doji',
                confidence: 0.7,
                direction: 'neutral',
                description: 'Indecision candle; potential reversal signal.',
                detectedAt: now,
            });
        }

        // Hammer (bullish)
        if (isBullish(last)) {
            const lowerShadow = Math.min(last.open, last.close) - last.low;
            const upperShadow = last.high - Math.max(last.open, last.close);
            if (lowerShadow > 2 * bodySize(last) && upperShadow < bodySize(last)) {
                results.push({
                    pattern: 'Hammer',
                    confidence: 0.75,
                    direction: 'bullish',
                    description: 'Potential bullish reversal after a downtrend.',
                    detectedAt: now,
                });
            }
        }

        // Shooting Star (bearish)
        if (isBearish(last)) {
            const upperShadow = last.high - Math.max(last.open, last.close);
            const lowerShadow = Math.min(last.open, last.close) - last.low;
            if (upperShadow > 2 * bodySize(last) && lowerShadow < bodySize(last)) {
                results.push({
                    pattern: 'Shooting Star',
                    confidence: 0.72,
                    direction: 'bearish',
                    description: 'Potential bearish reversal after an uptrend.',
                    detectedAt: now,
                });
            }
        }

        // Bullish Engulfing
        if (isBearish(prev) && isBullish(last) && last.open < prev.close && last.close > prev.open) {
            results.push({
                pattern: 'Bullish Engulfing',
                confidence: 0.8,
                direction: 'bullish',
                description: 'Strong bullish reversal signal.',
                detectedAt: now,
            });
        }

        // Bearish Engulfing
        if (isBullish(prev) && isBearish(last) && last.open > prev.close && last.close < prev.open) {
            results.push({
                pattern: 'Bearish Engulfing',
                confidence: 0.8,
                direction: 'bearish',
                description: 'Strong bearish reversal signal.',
                detectedAt: now,
            });
        }

        // Morning Star
        if (
            isBearish(prev2) &&
            bodySize(prev) < bodySize(prev2) * 0.3 &&
            isBullish(last) &&
            last.close > (prev2.open + prev2.close) / 2
        ) {
            results.push({
                pattern: 'Morning Star',
                confidence: 0.82,
                direction: 'bullish',
                description: 'Three-candle bullish reversal pattern.',
                detectedAt: now,
            });
        }

        // Evening Star
        if (
            isBullish(prev2) &&
            bodySize(prev) < bodySize(prev2) * 0.3 &&
            isBearish(last) &&
            last.close < (prev2.open + prev2.close) / 2
        ) {
            results.push({
                pattern: 'Evening Star',
                confidence: 0.82,
                direction: 'bearish',
                description: 'Three-candle bearish reversal pattern.',
                detectedAt: now,
            });
        }

        return results;
    }

    // ─── Full Analysis ────────────────────────────────────────────────────────

    /**
     * Run a full technical analysis on a symbol's price history.
     */
    public analyse(symbol: string, prices: PricePoint[]): TradingDataAnalysisResult {
        return {
            symbol,
            priceTrend: this.analysePriceTrend(symbol, prices),
            volumeAnalysis: this.analyseVolume(prices),
            volatility: this.calculateVolatility(symbol, prices),
            patterns: this.recognisePatterns(prices),
            rsi: this.calculateRSI(prices),
            macd: this.calculateMACD(prices),
            analysedAt: Date.now(),
        };
    }
}

export const tradingDataAnalysisService = TradingDataAnalysisService.getInstance();
