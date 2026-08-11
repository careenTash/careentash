import { PortfolioAnalysisService } from '../portfolio-analysis.service';
import type { PortfolioAsset, TradeRecord } from '../../../types/analysis.types';

const makeAsset = (symbol: string, qty: number, current: number, entry: number): PortfolioAsset => ({
    symbol,
    quantity: qty,
    currentPrice: current,
    averageEntryPrice: entry,
});

const makeTrade = (profit: number, entryTime = 0, exitTime = 86_400_000): TradeRecord => ({
    id: String(Math.random()),
    symbol: 'TEST',
    direction: 'buy',
    entryPrice: 100,
    exitPrice: 100 + profit,
    entryTime,
    exitTime,
    contractSize: 1,
    profit,
});

describe('PortfolioAnalysisService', () => {
    let service: PortfolioAnalysisService;

    beforeEach(() => {
        service = PortfolioAnalysisService.getInstance();
    });

    it('returns the same singleton instance', () => {
        expect(service).toBe(PortfolioAnalysisService.getInstance());
    });

    describe('calculatePerformance', () => {
        it('calculates unrealised PnL correctly', () => {
            const assets = [makeAsset('A', 10, 110, 100)]; // +10 per unit
            const result = service.calculatePerformance(assets);
            expect(result.totalValue).toBeCloseTo(1100);
            expect(result.totalCost).toBeCloseTo(1000);
            expect(result.unrealisedPnL).toBeCloseTo(100);
            expect(result.unrealisedPnLPercent).toBeCloseTo(10);
        });

        it('includes realisedPnL in totalReturn', () => {
            const assets = [makeAsset('A', 10, 100, 100)];
            const result = service.calculatePerformance(assets, 50);
            expect(result.totalReturn).toBeCloseTo(50);
            expect(result.realisedPnL).toBe(50);
        });

        it('identifies best and worst performers', () => {
            const assets = [makeAsset('A', 1, 150, 100), makeAsset('B', 1, 80, 100)];
            const result = service.calculatePerformance(assets);
            expect(result.bestPerformer).toBe('A');
            expect(result.worstPerformer).toBe('B');
        });

        it('handles empty asset list', () => {
            const result = service.calculatePerformance([]);
            expect(result.totalValue).toBe(0);
            expect(result.totalCost).toBe(0);
        });
    });

    describe('calculateRiskMetrics', () => {
        it('returns zero metrics for empty trades', () => {
            const result = service.calculateRiskMetrics([]);
            expect(result.sharpeRatio).toBe(0);
            expect(result.maxDrawdown).toBe(0);
        });

        it('calculates Sharpe ratio (non-zero for mixed trades)', () => {
            const trades = [makeTrade(10), makeTrade(-5), makeTrade(8), makeTrade(-3), makeTrade(12)];
            const result = service.calculateRiskMetrics(trades);
            expect(typeof result.sharpeRatio).toBe('number');
            expect(result.sharpeRatio).toBeGreaterThan(0);
        });

        it('calculates max drawdown', () => {
            const trades = [makeTrade(10), makeTrade(-20), makeTrade(5)];
            const result = service.calculateRiskMetrics(trades);
            expect(result.maxDrawdown).toBeGreaterThan(0);
        });

        it('VaR values are non-negative', () => {
            const trades = Array.from({ length: 20 }, (_, i) => makeTrade(i % 3 === 0 ? -10 : 5));
            const result = service.calculateRiskMetrics(trades);
            expect(result.valueAtRisk95).toBeGreaterThanOrEqual(0);
            expect(result.valueAtRisk99).toBeGreaterThanOrEqual(0);
        });
    });

    describe('analyseAllocations', () => {
        it('calculates equal allocations for equal assets', () => {
            const assets = [makeAsset('A', 1, 100, 100), makeAsset('B', 1, 100, 100)];
            const result = service.analyseAllocations(assets);
            expect(result).toHaveLength(2);
            result.forEach(r => expect(r.currentAllocationPercent).toBeCloseTo(50));
        });

        it('marks overweight asset', () => {
            const assets = [makeAsset('A', 9, 100, 100), makeAsset('B', 1, 100, 100)];
            const result = service.analyseAllocations(assets);
            const a = result.find(r => r.symbol === 'A')!;
            expect(a.overweight).toBe(true);
        });

        it('returns empty array for empty input', () => {
            expect(service.analyseAllocations([])).toEqual([]);
        });
    });

    describe('calculateDiversificationScore', () => {
        it('returns 0 for a single asset', () => {
            const assets = [makeAsset('A', 1, 100, 100)];
            expect(service.calculateDiversificationScore(assets)).toBe(0);
        });

        it('returns 1 for perfectly equal allocation', () => {
            const assets = [makeAsset('A', 1, 100, 100), makeAsset('B', 1, 100, 100)];
            expect(service.calculateDiversificationScore(assets)).toBeCloseTo(1);
        });

        it('returns a lower score for concentrated portfolios', () => {
            const balanced = [makeAsset('A', 1, 100, 100), makeAsset('B', 1, 100, 100)];
            const concentrated = [makeAsset('A', 9, 100, 100), makeAsset('B', 1, 100, 100)];
            expect(service.calculateDiversificationScore(balanced))
                .toBeGreaterThan(service.calculateDiversificationScore(concentrated));
        });
    });

    describe('analyse', () => {
        it('returns a full PortfolioAnalysisResult', () => {
            const assets = [makeAsset('A', 5, 110, 100), makeAsset('B', 3, 90, 100)];
            const trades = [makeTrade(10), makeTrade(-5)];
            const result = service.analyse(assets, trades);
            expect(result).toHaveProperty('performance');
            expect(result).toHaveProperty('risk');
            expect(result).toHaveProperty('allocations');
            expect(typeof result.diversificationScore).toBe('number');
            expect(typeof result.analysedAt).toBe('number');
        });
    });
});
