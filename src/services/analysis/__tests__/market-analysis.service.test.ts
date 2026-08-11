import { MarketAnalysisService } from '../market-analysis.service';
import type { PricePoint } from '../../../types/analysis.types';

const makePrices = (closes: number[]): PricePoint[] =>
    closes.map((close, i) => ({
        timestamp: 1_000_000 + i * 60_000,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
    }));

describe('MarketAnalysisService', () => {
    let service: MarketAnalysisService;

    beforeEach(() => {
        service = MarketAnalysisService.getInstance();
    });

    it('returns the same singleton instance', () => {
        expect(service).toBe(MarketAnalysisService.getInstance());
    });

    describe('analyseSentiment', () => {
        it('returns neutral for insufficient data', () => {
            const result = service.analyseSentiment('TEST', []);
            expect(result.sentiment).toBe('neutral');
            expect(result.score).toBe(0);
        });

        it('returns bullish for a strongly rising series', () => {
            const prices = makePrices(Array.from({ length: 40 }, (_, i) => 100 + i * 2));
            const result = service.analyseSentiment('TEST', prices);
            expect(['bullish', 'very_bullish']).toContain(result.sentiment);
        });

        it('returns bearish for a strongly falling series', () => {
            const prices = makePrices(Array.from({ length: 40 }, (_, i) => 200 - i * 2));
            const result = service.analyseSentiment('TEST', prices);
            expect(['bearish', 'very_bearish']).toContain(result.sentiment);
        });

        it('returns signals array with weights summing to 1', () => {
            const prices = makePrices([100, 101, 102]);
            const result = service.analyseSentiment('TEST', prices);
            const totalWeight = result.signals.reduce((s, sig) => s + sig.weight, 0);
            expect(totalWeight).toBeCloseTo(1);
        });

        it('score is clamped between -1 and 1', () => {
            const prices = makePrices(Array.from({ length: 50 }, (_, i) => 100 + i * 10));
            const result = service.analyseSentiment('TEST', prices);
            expect(result.score).toBeGreaterThanOrEqual(-1);
            expect(result.score).toBeLessThanOrEqual(1);
        });
    });

    describe('predictPrice', () => {
        it('returns currentPrice when no data', () => {
            const result = service.predictPrice('TEST', []);
            expect(result.currentPrice).toBe(0);
            expect(result.confidence).toBe(0);
        });

        it('predicts upward for rising series', () => {
            const prices = makePrices(Array.from({ length: 30 }, (_, i) => 100 + i));
            const result = service.predictPrice('TEST', prices, 'short');
            expect(result.predictedPrice).toBeGreaterThan(result.currentPrice);
        });

        it('returns the correct horizon', () => {
            const prices = makePrices([100, 101, 102]);
            expect(service.predictPrice('TEST', prices, 'long').horizon).toBe('long');
        });

        it('confidence is between 0 and 1', () => {
            const prices = makePrices(Array.from({ length: 20 }, (_, i) => 100 + i));
            const result = service.predictPrice('TEST', prices);
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
        });
    });

    describe('calculateCorrelation', () => {
        it('returns ~1 for identical series', () => {
            const prices = makePrices([100, 101, 102, 103, 104]);
            const result = service.calculateCorrelation('A', prices, 'B', [...prices]);
            expect(result.correlation).toBeCloseTo(1, 1);
            expect(result.interpretation).toBe('strong_positive');
        });

        it('returns ~-1 for perfectly inverse series', () => {
            const a = makePrices([100, 101, 102, 103, 104]);
            const b = makePrices([104, 103, 102, 101, 100]);
            const result = service.calculateCorrelation('A', a, 'B', b);
            expect(result.correlation).toBeCloseTo(-1, 1);
            expect(result.interpretation).toBe('strong_negative');
        });

        it('handles mismatched series lengths', () => {
            const a = makePrices([100, 101, 102]);
            const b = makePrices([200, 201]);
            const result = service.calculateCorrelation('A', a, 'B', b);
            expect(result.sampleSize).toBe(2);
        });

        it('returns 0 correlation for single-element series', () => {
            const result = service.calculateCorrelation('A', makePrices([100]), 'B', makePrices([200]));
            expect(result.correlation).toBe(0);
        });
    });

    describe('calculateCorrelations', () => {
        it('returns an entry per other symbol', () => {
            const prices = makePrices([100, 101, 102]);
            const others = [
                { symbol: 'B', prices: makePrices([200, 201, 202]) },
                { symbol: 'C', prices: makePrices([50, 51, 52]) },
            ];
            const results = service.calculateCorrelations('A', prices, others);
            expect(results).toHaveLength(2);
        });
    });

    describe('analyse', () => {
        it('returns a full MarketAnalysisResult', () => {
            const prices = makePrices(Array.from({ length: 30 }, (_, i) => 100 + i));
            const result = service.analyse('TEST', prices);
            expect(result).toHaveProperty('sentiment');
            expect(result).toHaveProperty('prediction');
            expect(result).toHaveProperty('correlations');
            expect(typeof result.analysedAt).toBe('number');
        });
    });
});
