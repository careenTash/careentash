import { FinancialMetricsService } from '../financial-metrics.service';
import type { TradeRecord } from '../../../types/analysis.types';

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

describe('FinancialMetricsService', () => {
    let service: FinancialMetricsService;

    beforeEach(() => {
        service = FinancialMetricsService.getInstance();
    });

    it('returns the same singleton instance', () => {
        expect(service).toBe(FinancialMetricsService.getInstance());
    });

    describe('calculateROI', () => {
        it('returns zeros for empty trades', () => {
            const result = service.calculateROI([]);
            expect(result.totalROI).toBe(0);
            expect(result.totalROIPercent).toBe(0);
        });

        it('calculates total ROI correctly', () => {
            const trades = [
                makeTrade(10, 0, 86_400_000),
                makeTrade(20, 86_400_000, 172_800_000),
            ];
            const result = service.calculateROI(trades);
            expect(result.totalROI).toBeCloseTo(30);
            // totalInvested = 200 (2 × 100 × 1), ROI% = 15
            expect(result.totalROIPercent).toBeCloseTo(15);
        });

        it('calculates period days correctly', () => {
            const trades = [
                makeTrade(5, 0, 0),
                makeTrade(5, 0, 2 * 86_400_000), // 2 days
            ];
            const result = service.calculateROI(trades);
            expect(result.periodDays).toBeCloseTo(2);
        });

        it('annualised ROI is greater than simple ROI for profitable short periods', () => {
            const trades = [makeTrade(10, 0, 86_400_000)]; // 1 day
            const result = service.calculateROI(trades);
            expect(result.annualisedROI).toBeGreaterThan(result.totalROIPercent);
        });
    });

    describe('calculateWinLoss', () => {
        it('returns zeros for empty trades', () => {
            const result = service.calculateWinLoss([]);
            expect(result.totalTrades).toBe(0);
            expect(result.winRate).toBe(0);
        });

        it('calculates win rate correctly', () => {
            const trades = [makeTrade(10), makeTrade(10), makeTrade(-5)];
            const result = service.calculateWinLoss(trades);
            expect(result.totalTrades).toBe(3);
            expect(result.winningTrades).toBe(2);
            expect(result.losingTrades).toBe(1);
            expect(result.winRate).toBeCloseTo(2 / 3);
        });

        it('calculates profit factor correctly', () => {
            const trades = [makeTrade(20), makeTrade(-10)];
            const result = service.calculateWinLoss(trades);
            expect(result.profitFactor).toBeCloseTo(2);
        });

        it('positive expectancy for profitable set', () => {
            const trades = [makeTrade(15), makeTrade(15), makeTrade(-5)];
            const result = service.calculateWinLoss(trades);
            expect(result.expectancy).toBeGreaterThan(0);
        });

        it('infinite profit factor when no losses', () => {
            const trades = [makeTrade(10), makeTrade(20)];
            const result = service.calculateWinLoss(trades);
            expect(result.profitFactor).toBe(Infinity);
        });
    });

    describe('calculateDrawdown', () => {
        it('returns zeros for empty trades', () => {
            const result = service.calculateDrawdown([]);
            expect(result.maxDrawdown).toBe(0);
            expect(result.recoveryFactor).toBe(0);
        });

        it('detects max drawdown correctly', () => {
            // equity: 10, 20, 0, 5
            const trades = [
                makeTrade(10, 0, 1000),
                makeTrade(10, 1000, 2000),
                makeTrade(-20, 2000, 3000),
                makeTrade(5, 3000, 4000),
            ];
            const result = service.calculateDrawdown(trades);
            expect(result.maxDrawdown).toBeCloseTo(20);
        });

        it('recoveryFactor is positive when profitable overall', () => {
            const trades = [makeTrade(10), makeTrade(-3), makeTrade(8)];
            const result = service.calculateDrawdown(trades);
            expect(result.recoveryFactor).toBeGreaterThan(0);
        });

        it('currentDrawdown is 0 after full recovery', () => {
            const trades = [
                makeTrade(20, 0, 1000),
                makeTrade(-10, 1000, 2000),
                makeTrade(15, 2000, 3000),
            ];
            const result = service.calculateDrawdown(trades);
            expect(result.currentDrawdown).toBe(0);
        });
    });

    describe('calculate', () => {
        it('returns a full FinancialMetricsResult', () => {
            const trades = [makeTrade(10), makeTrade(-5), makeTrade(15)];
            const result = service.calculate(trades);
            expect(result).toHaveProperty('roi');
            expect(result).toHaveProperty('winLoss');
            expect(result).toHaveProperty('drawdown');
            expect(typeof result.calculatedAt).toBe('number');
        });
    });
});
