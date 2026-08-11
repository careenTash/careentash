/**
 * Financial Metrics Service
 *
 * Provides ROI calculations, win/loss ratio analysis, and drawdown/risk metrics
 * derived from completed trade records.
 */

import type {
    DrawdownMetrics,
    FinancialMetricsResult,
    ROIMetrics,
    TradeRecord,
    WinLossMetrics,
} from '../../types/analysis.types';

export class FinancialMetricsService {
    private static instance: FinancialMetricsService;

    private constructor() {}

    public static getInstance(): FinancialMetricsService {
        if (!FinancialMetricsService.instance) {
            FinancialMetricsService.instance = new FinancialMetricsService();
        }
        return FinancialMetricsService.instance;
    }

    // ─── ROI ──────────────────────────────────────────────────────────────────

    /**
     * Calculate Return on Investment metrics for a set of trades.
     */
    public calculateROI(trades: TradeRecord[]): ROIMetrics {
        if (!trades || trades.length === 0) {
            return { totalROI: 0, totalROIPercent: 0, annualisedROI: 0, periodDays: 0 };
        }

        const totalROI = trades.reduce((s, t) => s + t.profit, 0);
        const totalInvested = trades.reduce((s, t) => s + t.entryPrice * t.contractSize, 0);
        const totalROIPercent = totalInvested !== 0 ? (totalROI / totalInvested) * 100 : 0;

        const timestamps = trades.map(t => t.entryTime);
        const firstEntry = Math.min(...timestamps);
        const lastExit = Math.max(...trades.map(t => t.exitTime));
        const periodDays = (lastExit - firstEntry) / (1000 * 60 * 60 * 24);

        const annualisedROI =
            periodDays > 0 ? ((1 + totalROIPercent / 100) ** (365 / periodDays) - 1) * 100 : 0;

        return { totalROI, totalROIPercent, annualisedROI, periodDays };
    }

    // ─── Win/Loss ─────────────────────────────────────────────────────────────

    /**
     * Calculate win/loss ratio and related metrics.
     */
    public calculateWinLoss(trades: TradeRecord[]): WinLossMetrics {
        if (!trades || trades.length === 0) {
            return {
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                lossRate: 0,
                averageWin: 0,
                averageLoss: 0,
                profitFactor: 0,
                expectancy: 0,
            };
        }

        const wins = trades.filter(t => t.profit > 0);
        const losses = trades.filter(t => t.profit <= 0);

        const totalTrades = trades.length;
        const winningTrades = wins.length;
        const losingTrades = losses.length;
        const winRate = winningTrades / totalTrades;
        const lossRate = losingTrades / totalTrades;

        const totalWins = wins.reduce((s, t) => s + t.profit, 0);
        const totalLosses = Math.abs(losses.reduce((s, t) => s + t.profit, 0));

        const averageWin = winningTrades > 0 ? totalWins / winningTrades : 0;
        const averageLoss = losingTrades > 0 ? totalLosses / losingTrades : 0;
        const profitFactor = totalLosses !== 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

        // Expectancy = (win rate × avg win) − (loss rate × avg loss)
        const expectancy = winRate * averageWin - lossRate * averageLoss;

        return {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate,
            lossRate,
            averageWin,
            averageLoss,
            profitFactor,
            expectancy,
        };
    }

    // ─── Drawdown ─────────────────────────────────────────────────────────────

    /**
     * Calculate drawdown metrics from a chronological sequence of trades.
     */
    public calculateDrawdown(trades: TradeRecord[]): DrawdownMetrics {
        if (!trades || trades.length === 0) {
            return {
                maxDrawdown: 0,
                maxDrawdownPercent: 0,
                averageDrawdown: 0,
                longestDrawdownPeriodDays: 0,
                currentDrawdown: 0,
                currentDrawdownPercent: 0,
                recoveryFactor: 0,
            };
        }

        const sorted = [...trades].sort((a, b) => a.exitTime - b.exitTime);

        let equity = 0;
        let peak = 0;
        let maxDrawdown = 0;
        let drawdownStart = 0;
        let longestDrawdownMs = 0;
        let inDrawdown = false;
        const drawdowns: number[] = [];

        for (const trade of sorted) {
            equity += trade.profit;
            if (equity > peak) {
                // Equity has recovered to a new peak — end any active drawdown period
                if (inDrawdown) {
                    const duration = trade.exitTime - drawdownStart;
                    if (duration > longestDrawdownMs) longestDrawdownMs = duration;
                    inDrawdown = false;
                }
                peak = equity;
            }
            const drawdown = peak - equity;
            if (drawdown > 0) {
                drawdowns.push(drawdown);
                if (!inDrawdown) {
                    // Start tracking a new drawdown period from the last peak
                    drawdownStart = trade.exitTime;
                    inDrawdown = true;
                }
            }
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }

        // Close any drawdown still open at the end of the series
        if (inDrawdown && sorted.length > 0) {
            const duration = sorted[sorted.length - 1].exitTime - drawdownStart;
            if (duration > longestDrawdownMs) longestDrawdownMs = duration;
        }

        const maxDrawdownPercent = peak !== 0 ? (maxDrawdown / peak) * 100 : 0;
        const averageDrawdown = drawdowns.length > 0 ? drawdowns.reduce((s, d) => s + d, 0) / drawdowns.length : 0;
        const longestDrawdownPeriodDays = longestDrawdownMs / (1000 * 60 * 60 * 24);

        const currentDrawdown = Math.max(0, peak - equity);
        const currentDrawdownPercent = peak !== 0 ? (currentDrawdown / peak) * 100 : 0;

        const totalProfit = equity; // equity is already the running sum of all profits
        const recoveryFactor = maxDrawdown !== 0 ? totalProfit / maxDrawdown : 0;

        return {
            maxDrawdown,
            maxDrawdownPercent,
            averageDrawdown,
            longestDrawdownPeriodDays,
            currentDrawdown,
            currentDrawdownPercent,
            recoveryFactor,
        };
    }

    // ─── Full Metrics ─────────────────────────────────────────────────────────

    /**
     * Calculate all financial metrics for a set of trades.
     */
    public calculate(trades: TradeRecord[]): FinancialMetricsResult {
        return {
            roi: this.calculateROI(trades),
            winLoss: this.calculateWinLoss(trades),
            drawdown: this.calculateDrawdown(trades),
            calculatedAt: Date.now(),
        };
    }
}

export const financialMetricsService = FinancialMetricsService.getInstance();
