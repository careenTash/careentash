/**
 * Portfolio Analysis Service
 *
 * Provides portfolio performance metrics, risk assessment, and
 * allocation optimisation suggestions.
 */

import type {
    AllocationResult,
    PortfolioAnalysisResult,
    PortfolioAsset,
    PortfolioPerformanceMetrics,
    RiskMetrics,
    TradeRecord,
} from '../../types/analysis.types';

export class PortfolioAnalysisService {
    private static instance: PortfolioAnalysisService;

    private constructor() {}

    public static getInstance(): PortfolioAnalysisService {
        if (!PortfolioAnalysisService.instance) {
            PortfolioAnalysisService.instance = new PortfolioAnalysisService();
        }
        return PortfolioAnalysisService.instance;
    }

    // ─── Performance ─────────────────────────────────────────────────────────

    /**
     * Calculate portfolio performance metrics from current holdings.
     */
    public calculatePerformance(assets: PortfolioAsset[], realisedPnL = 0): PortfolioPerformanceMetrics {
        if (!assets || assets.length === 0) {
            return {
                totalValue: 0,
                totalCost: 0,
                unrealisedPnL: 0,
                unrealisedPnLPercent: 0,
                realisedPnL,
                totalReturn: realisedPnL,
                totalReturnPercent: 0,
                bestPerformer: '',
                worstPerformer: '',
            };
        }

        let totalValue = 0;
        let totalCost = 0;
        let bestGain = -Infinity;
        let worstGain = Infinity;
        let bestPerformer = '';
        let worstPerformer = '';

        for (const asset of assets) {
            const value = asset.quantity * asset.currentPrice;
            const cost = asset.quantity * asset.averageEntryPrice;
            const gain = cost !== 0 ? ((value - cost) / cost) * 100 : 0;
            totalValue += value;
            totalCost += cost;
            if (gain > bestGain) { bestGain = gain; bestPerformer = asset.symbol; }
            if (gain < worstGain) { worstGain = gain; worstPerformer = asset.symbol; }
        }

        const unrealisedPnL = totalValue - totalCost;
        const unrealisedPnLPercent = totalCost !== 0 ? (unrealisedPnL / totalCost) * 100 : 0;
        const totalReturn = unrealisedPnL + realisedPnL;
        const totalReturnPercent = totalCost !== 0 ? (totalReturn / totalCost) * 100 : 0;

        return {
            totalValue,
            totalCost,
            unrealisedPnL,
            unrealisedPnLPercent,
            realisedPnL,
            totalReturn,
            totalReturnPercent,
            bestPerformer,
            worstPerformer,
        };
    }

    // ─── Risk Metrics ─────────────────────────────────────────────────────────

    /**
     * Calculate portfolio risk metrics from a series of completed trades.
     */
    public calculateRiskMetrics(trades: TradeRecord[]): RiskMetrics {
        if (!trades || trades.length === 0) {
            return {
                portfolioBeta: 1,
                sharpeRatio: 0,
                sortinoRatio: 0,
                maxDrawdown: 0,
                maxDrawdownPercent: 0,
                valueAtRisk95: 0,
                valueAtRisk99: 0,
            };
        }

        const profits = trades.map(t => t.profit);
        const avgProfit = profits.reduce((s, p) => s + p, 0) / profits.length;

        // Sharpe ratio (simplified, no risk-free rate)
        const variance = profits.reduce((s, p) => s + (p - avgProfit) ** 2, 0) / profits.length;
        const stdDev = Math.sqrt(variance);
        const sharpeRatio = stdDev !== 0 ? avgProfit / stdDev : 0;

        // Sortino ratio (uses downside deviation only)
        const negativeReturns = profits.filter(p => p < 0);
        const downsideVariance = negativeReturns.length > 0
            ? negativeReturns.reduce((s, p) => s + p ** 2, 0) / negativeReturns.length
            : 0;
        const downsideDeviation = Math.sqrt(downsideVariance);
        const sortinoRatio = downsideDeviation !== 0 ? avgProfit / downsideDeviation : 0;

        // Max drawdown
        let peak = 0;
        let equity = 0;
        let maxDrawdown = 0;
        let peakEquity = 0;

        for (const profit of profits) {
            equity += profit;
            if (equity > peak) { peak = equity; peakEquity = peak; }
            const drawdown = peak - equity;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
        const maxDrawdownPercent = peakEquity !== 0 ? (maxDrawdown / peakEquity) * 100 : 0;

        // Value at Risk (historical simulation)
        const sorted = [...profits].sort((a, b) => a - b);
        const var95Index = Math.floor(sorted.length * 0.05);
        const var99Index = Math.floor(sorted.length * 0.01);
        const valueAtRisk95 = sorted[var95Index] != null ? Math.abs(Math.min(0, sorted[var95Index])) : 0;
        const valueAtRisk99 = sorted[var99Index] != null ? Math.abs(Math.min(0, sorted[var99Index])) : 0;

        return {
            portfolioBeta: 1, // requires market benchmark data
            sharpeRatio,
            sortinoRatio,
            maxDrawdown,
            maxDrawdownPercent,
            valueAtRisk95,
            valueAtRisk99,
        };
    }

    // ─── Allocation ───────────────────────────────────────────────────────────

    /**
     * Compute current allocations and suggest equal-weight targets.
     */
    public analyseAllocations(assets: PortfolioAsset[]): AllocationResult[] {
        if (!assets || assets.length === 0) return [];

        const totalValue = assets.reduce((s, a) => s + a.quantity * a.currentPrice, 0);
        if (totalValue === 0) return [];

        const equalWeight = 1 / assets.length;

        return assets.map(asset => {
            const value = asset.quantity * asset.currentPrice;
            const currentAllocation = value / totalValue;
            const currentAllocationPercent = currentAllocation * 100;
            const deviation = currentAllocation - equalWeight;
            return {
                symbol: asset.symbol,
                displayName: asset.displayName,
                currentAllocation,
                currentAllocationPercent,
                suggestedAllocation: equalWeight,
                overweight: deviation > 0.05,
                underweight: deviation < -0.05,
            };
        });
    }

    // ─── Diversification Score ───────────────────────────────────────────────

    /**
     * Estimate diversification using the Herfindahl-Hirschman Index (HHI).
     * Returns a score between 0 (concentrated) and 1 (perfectly diversified).
     */
    public calculateDiversificationScore(assets: PortfolioAsset[]): number {
        if (!assets || assets.length === 0) return 0;
        const totalValue = assets.reduce((s, a) => s + a.quantity * a.currentPrice, 0);
        if (totalValue === 0) return 0;
        const hhi = assets.reduce((s, a) => {
            const share = (a.quantity * a.currentPrice) / totalValue;
            return s + share ** 2;
        }, 0);
        // 1 = maximally concentrated, 1/n = equal weight → normalise to 0–1
        const minHHI = 1 / assets.length;
        return assets.length > 1 ? Math.max(0, (1 - hhi) / (1 - minHHI)) : 0;
    }

    // ─── Full Analysis ────────────────────────────────────────────────────────

    /**
     * Run a complete portfolio analysis.
     */
    public analyse(assets: PortfolioAsset[], trades: TradeRecord[] = []): PortfolioAnalysisResult {
        const realisedPnL = trades.reduce((s, t) => s + t.profit, 0);
        return {
            performance: this.calculatePerformance(assets, realisedPnL),
            risk: this.calculateRiskMetrics(trades),
            allocations: this.analyseAllocations(assets),
            diversificationScore: this.calculateDiversificationScore(assets),
            analysedAt: Date.now(),
        };
    }
}

export const portfolioAnalysisService = PortfolioAnalysisService.getInstance();
