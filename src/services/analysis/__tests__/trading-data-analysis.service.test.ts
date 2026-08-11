import { TradingDataAnalysisService } from '../trading-data-analysis.service';
import type { PricePoint } from '../../../types/analysis.types';

const makePrices = (closes: number[]): PricePoint[] =>
    closes.map((close, i) => ({
        timestamp: 1_000_000 + i * 60_000,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000 + i * 10,
    }));

describe('TradingDataAnalysisService', () => {
    let service: TradingDataAnalysisService;

    beforeEach(() => {
        service = TradingDataAnalysisService.getInstance();
    });

    it('returns the same singleton instance', () => {
        expect(service).toBe(TradingDataAnalysisService.getInstance());
    });

    describe('calculateSMA', () => {
        it('calculates simple moving average correctly', () => {
            const prices = makePrices([1, 2, 3, 4, 5]);
            expect(service.calculateSMA(prices, 5)).toBeCloseTo(3);
        });

        it('returns 0 when not enough data', () => {
            const prices = makePrices([1, 2]);
            expect(service.calculateSMA(prices, 5)).toBe(0);
        });

        it('returns 0 for empty array', () => {
            expect(service.calculateSMA([], 5)).toBe(0);
        });
    });

    describe('calculateEMA', () => {
        it('returns last price for single-element input', () => {
            const prices = makePrices([100]);
            expect(service.calculateEMA(prices, 12)).toBe(100);
        });

        it('returns 0 for empty array', () => {
            expect(service.calculateEMA([], 12)).toBe(0);
        });

        it('responds to price changes', () => {
            const rising = makePrices([10, 20, 30, 40, 50]);
            const falling = makePrices([50, 40, 30, 20, 10]);
            expect(service.calculateEMA(rising, 3)).toBeGreaterThan(service.calculateEMA(falling, 3));
        });
    });

    describe('analysePriceTrend', () => {
        it('detects uptrend', () => {
            const prices = makePrices(Array.from({ length: 60 }, (_, i) => 100 + i));
            const result = service.analysePriceTrend('TEST', prices);
            expect(result.trend).toBe('uptrend');
            expect(result.strength).toBeGreaterThan(0);
        });

        it('detects downtrend', () => {
            const prices = makePrices(Array.from({ length: 60 }, (_, i) => 200 - i));
            const result = service.analysePriceTrend('TEST', prices);
            expect(result.trend).toBe('downtrend');
        });

        it('handles insufficient data gracefully', () => {
            const result = service.analysePriceTrend('TEST', makePrices([100]));
            expect(result.trend).toBe('sideways');
            expect(result.strength).toBe(0);
        });

        it('returns correct symbol', () => {
            const result = service.analysePriceTrend('EUR_USD', makePrices([1, 2]));
            expect(result.symbol).toBe('EUR_USD');
        });
    });

    describe('analyseVolume', () => {
        it('detects increasing volume', () => {
            // First 5 prices have low volume; last 5 have high volume → recent avg > overall avg
            const prices = [
                ...makePrices([10, 10, 10, 10, 10]).map(p => ({ ...p, volume: 100 })),
                ...makePrices([10, 10, 10, 10, 10]).map(p => ({ ...p, volume: 500 })),
            ];
            const result = service.analyseVolume(prices);
            expect(result.volumeTrend).toBe('increasing');
        });

        it('returns stable for no volume data', () => {
            const prices = makePrices([10, 10]).map(p => ({ ...p, volume: undefined }));
            const result = service.analyseVolume(prices);
            expect(result.volumeTrend).toBe('stable');
        });
    });

    describe('calculateVolatility', () => {
        it('returns higher ATR for volatile series', () => {
            const volatile = Array.from({ length: 20 }, (_, i) => ({
                timestamp: i,
                open: 100,
                high: 110 + (i % 2) * 20,
                low: 90 - (i % 2) * 20,
                close: 100,
            }));
            const calm = Array.from({ length: 20 }, (_, i) => ({
                timestamp: i,
                open: 100,
                high: 101,
                low: 99,
                close: 100,
            }));
            expect(service.calculateVolatility('A', volatile).averageTrueRange)
                .toBeGreaterThan(service.calculateVolatility('A', calm).averageTrueRange);
        });

        it('returns zeroes for insufficient data', () => {
            const result = service.calculateVolatility('X', makePrices([100]));
            expect(result.standardDeviation).toBe(0);
        });
    });

    describe('calculateRSI', () => {
        it('returns 50 for insufficient data', () => {
            expect(service.calculateRSI(makePrices([100, 101, 102]))).toBe(50);
        });

        it('returns 100 when all moves are gains', () => {
            const prices = makePrices(Array.from({ length: 16 }, (_, i) => 100 + i));
            expect(service.calculateRSI(prices)).toBe(100);
        });
    });

    describe('calculateMACD', () => {
        it('returns zeros for insufficient data', () => {
            const result = service.calculateMACD(makePrices([100, 101]));
            expect(result).toEqual({ value: 0, signal: 0, histogram: 0 });
        });

        it('returns an object with value, signal, histogram', () => {
            const prices = makePrices(Array.from({ length: 35 }, (_, i) => 100 + i));
            const result = service.calculateMACD(prices);
            expect(result).toHaveProperty('value');
            expect(result).toHaveProperty('signal');
            expect(result).toHaveProperty('histogram');
        });
    });

    describe('recognisePatterns', () => {
        it('returns empty array for insufficient data', () => {
            expect(service.recognisePatterns(makePrices([100, 101]))).toEqual([]);
        });

        it('detects a Bullish Engulfing pattern', () => {
            const prices: PricePoint[] = [
                { timestamp: 1, open: 105, high: 106, low: 99, close: 100 }, // prev: bearish
                { timestamp: 2, open: 98, high: 110, low: 97, close: 109 }, // last: bullish engulfing
            ];
            // We need 3 candles for recognisePatterns
            const withPrev: PricePoint[] = [
                { timestamp: 0, open: 107, high: 108, low: 106, close: 106 },
                ...prices,
            ];
            const patterns = service.recognisePatterns(withPrev);
            expect(patterns.some(p => p.pattern === 'Bullish Engulfing')).toBe(true);
        });

        it('detects a Doji', () => {
            const prices: PricePoint[] = [
                { timestamp: 0, open: 100, high: 102, low: 98, close: 100 },
                { timestamp: 1, open: 100, high: 102, low: 98, close: 100 },
                { timestamp: 2, open: 100, high: 105, low: 95, close: 100.05 }, // tiny body
            ];
            const patterns = service.recognisePatterns(prices);
            expect(patterns.some(p => p.pattern === 'Doji')).toBe(true);
        });
    });

    describe('analyse', () => {
        it('returns a full TradingDataAnalysisResult', () => {
            const prices = makePrices(Array.from({ length: 30 }, (_, i) => 100 + i));
            const result = service.analyse('TEST', prices);
            expect(result.symbol).toBe('TEST');
            expect(result).toHaveProperty('priceTrend');
            expect(result).toHaveProperty('volumeAnalysis');
            expect(result).toHaveProperty('volatility');
            expect(result).toHaveProperty('patterns');
            expect(result).toHaveProperty('rsi');
            expect(result).toHaveProperty('macd');
            expect(typeof result.analysedAt).toBe('number');
        });
    });
});
