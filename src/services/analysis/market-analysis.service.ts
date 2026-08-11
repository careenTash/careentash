/**
 * Market Analysis Service
 *
 * Provides market sentiment analysis, price movement predictions,
 * and correlation analysis between assets.
 */

import type {
    CorrelationResult,
    MarketAnalysisResult,
    MarketSentimentResult,
    PricePrediction,
    PricePoint,
    SentimentLevel,
} from '../../types/analysis.types';
import { TradingDataAnalysisService } from './trading-data-analysis.service';

const tradingAnalysis = TradingDataAnalysisService.getInstance();

export class MarketAnalysisService {
    private static instance: MarketAnalysisService;

    private constructor() {}

    public static getInstance(): MarketAnalysisService {
        if (!MarketAnalysisService.instance) {
            MarketAnalysisService.instance = new MarketAnalysisService();
        }
        return MarketAnalysisService.instance;
    }

    // ─── Sentiment ────────────────────────────────────────────────────────────

    /**
     * Derive market sentiment from technical indicators.
     */
    public analyseSentiment(symbol: string, prices: PricePoint[]): MarketSentimentResult {
        if (!prices || prices.length < 2) {
            return { symbol, sentiment: 'neutral', score: 0, signals: [] };
        }

        const rsi = tradingAnalysis.calculateRSI(prices);
        const macd = tradingAnalysis.calculateMACD(prices);
        const trend = tradingAnalysis.analysePriceTrend(symbol, prices);

        // Normalise each indicator to a -1 … +1 sentiment contribution
        const rsiSignal = (rsi - 50) / 50; // RSI 50 → 0, 80 → +0.6, 20 → -0.6
        const macdSignal = macd.histogram > 0 ? Math.min(1, macd.histogram / (Math.abs(macd.value) || 1)) : Math.max(-1, macd.histogram / (Math.abs(macd.value) || 1));
        const trendSignal = trend.trend === 'uptrend' ? trend.strength : trend.trend === 'downtrend' ? -trend.strength : 0;

        const signals = [
            { name: 'RSI', value: rsiSignal, weight: 0.35 },
            { name: 'MACD', value: macdSignal, weight: 0.35 },
            { name: 'Trend', value: trendSignal, weight: 0.30 },
        ];

        const score = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
        const clampedScore = Math.max(-1, Math.min(1, score));

        const sentiment: SentimentLevel =
            clampedScore > 0.6
                ? 'very_bullish'
                : clampedScore > 0.2
                    ? 'bullish'
                    : clampedScore < -0.6
                        ? 'very_bearish'
                        : clampedScore < -0.2
                            ? 'bearish'
                            : 'neutral';

        return { symbol, sentiment, score: clampedScore, signals };
    }

    // ─── Price Prediction ─────────────────────────────────────────────────────

    /**
     * Generate a statistical price prediction using linear regression on close prices.
     */
    public predictPrice(symbol: string, prices: PricePoint[], horizon: 'short' | 'medium' | 'long' = 'short'): PricePrediction {
        const horizonSteps: Record<typeof horizon, number> = { short: 5, medium: 20, long: 60 };
        const steps = horizonSteps[horizon];

        if (!prices || prices.length < 2) {
            const currentPrice = prices?.[prices.length - 1]?.close ?? 0;
            return { symbol, currentPrice, predictedPrice: currentPrice, predictedChange: 0, predictedChangePercent: 0, confidence: 0, horizon, methodology: 'linear_regression' };
        }

        const n = prices.length;
        const closes = prices.map(p => p.close);

        // Ordinary Least Squares slope
        const xMean = (n - 1) / 2;
        const yMean = closes.reduce((s, c) => s + c, 0) / n;
        const ssxy = closes.reduce((s, c, i) => s + (i - xMean) * (c - yMean), 0);
        const ssxx = closes.reduce((s, _, i) => s + (i - xMean) ** 2, 0);
        const slope = ssxx !== 0 ? ssxy / ssxx : 0;
        const intercept = yMean - slope * xMean;

        const currentPrice = closes[n - 1];
        const predictedPrice = Math.max(0, intercept + slope * (n - 1 + steps));
        const predictedChange = predictedPrice - currentPrice;
        const predictedChangePercent = currentPrice !== 0 ? (predictedChange / currentPrice) * 100 : 0;

        // Confidence based on R²
        const residualSumSq = closes.reduce((s, c, i) => s + (c - (intercept + slope * i)) ** 2, 0);
        const totalSumSq = closes.reduce((s, c) => s + (c - yMean) ** 2, 0);
        const rSquared = totalSumSq !== 0 ? 1 - residualSumSq / totalSumSq : 0;
        const confidence = Math.max(0, Math.min(1, rSquared));

        return { symbol, currentPrice, predictedPrice, predictedChange, predictedChangePercent, confidence, horizon, methodology: 'linear_regression' };
    }

    // ─── Correlation ──────────────────────────────────────────────────────────

    /**
     * Calculate the Pearson correlation coefficient between two price series.
     */
    public calculateCorrelation(symbolA: string, pricesA: PricePoint[], symbolB: string, pricesB: PricePoint[]): CorrelationResult {
        const closesA = pricesA.map(p => p.close);
        const closesB = pricesB.map(p => p.close);
        const len = Math.min(closesA.length, closesB.length);

        if (len < 2) {
            return { symbolA, symbolB, correlation: 0, interpretation: 'weak', sampleSize: len };
        }

        const a = closesA.slice(-len);
        const b = closesB.slice(-len);
        const meanA = a.reduce((s, v) => s + v, 0) / len;
        const meanB = b.reduce((s, v) => s + v, 0) / len;
        const cov = a.reduce((s, v, i) => s + (v - meanA) * (b[i] - meanB), 0) / len;
        const stdA = Math.sqrt(a.reduce((s, v) => s + (v - meanA) ** 2, 0) / len);
        const stdB = Math.sqrt(b.reduce((s, v) => s + (v - meanB) ** 2, 0) / len);
        const correlation = stdA !== 0 && stdB !== 0 ? cov / (stdA * stdB) : 0;

        const interpretation: CorrelationResult['interpretation'] =
            correlation > 0.7
                ? 'strong_positive'
                : correlation > 0.3
                    ? 'moderate_positive'
                    : correlation < -0.7
                        ? 'strong_negative'
                        : correlation < -0.3
                            ? 'moderate_negative'
                            : 'weak';

        return { symbolA, symbolB, correlation, interpretation, sampleSize: len };
    }

    /**
     * Calculate correlations between one symbol and multiple others.
     */
    public calculateCorrelations(
        primarySymbol: string,
        primaryPrices: PricePoint[],
        otherSymbols: Array<{ symbol: string; prices: PricePoint[] }>
    ): CorrelationResult[] {
        return otherSymbols.map(({ symbol, prices }) =>
            this.calculateCorrelation(primarySymbol, primaryPrices, symbol, prices)
        );
    }

    // ─── Full Analysis ────────────────────────────────────────────────────────

    /**
     * Run a full market analysis for a symbol.
     */
    public analyse(
        symbol: string,
        prices: PricePoint[],
        otherSymbols: Array<{ symbol: string; prices: PricePoint[] }> = []
    ): MarketAnalysisResult {
        return {
            sentiment: this.analyseSentiment(symbol, prices),
            prediction: this.predictPrice(symbol, prices),
            correlations: this.calculateCorrelations(symbol, prices, otherSymbols),
            analysedAt: Date.now(),
        };
    }
}

export const marketAnalysisService = MarketAnalysisService.getInstance();
