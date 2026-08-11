/**
 * Analysis Export Service
 *
 * Provides export functionality for analysis results in CSV and JSON formats.
 */

import type { ExportOptions, ExportResult } from '../../types/analysis.types';

export class AnalysisExportService {
    private static instance: AnalysisExportService;

    private constructor() {}

    public static getInstance(): AnalysisExportService {
        if (!AnalysisExportService.instance) {
            AnalysisExportService.instance = new AnalysisExportService();
        }
        return AnalysisExportService.instance;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private generateFilename(base: string, format: string): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `${base}_${timestamp}.${format}`;
    }

    /**
     * Flatten a nested object to a single-level record (for CSV serialisation).
     */
    private flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
                Object.assign(result, this.flattenObject(value as Record<string, unknown>, fullKey));
            } else if (Array.isArray(value)) {
                result[fullKey] = JSON.stringify(value);
            } else {
                result[fullKey] = String(value ?? '');
            }
        }
        return result;
    }

    // ─── Serialisers ──────────────────────────────────────────────────────────

    /**
     * Convert an array of records to a CSV string.
     */
    public toCSV<T extends Record<string, unknown>>(records: T[], includeHeaders = true): string {
        if (!records || records.length === 0) return '';

        const flattened = records.map(r => this.flattenObject(r));
        const headers = [...new Set(flattened.flatMap(r => Object.keys(r)))];

        const escape = (value: string) =>
            value.includes(',') || value.includes('"') || value.includes('\n')
                ? `"${value.replace(/"/g, '""')}"`
                : value;

        const rows = flattened.map(r => headers.map(h => escape(r[h] ?? '')).join(','));
        return includeHeaders ? [headers.join(','), ...rows].join('\n') : rows.join('\n');
    }

    /**
     * Convert data to a formatted JSON string.
     */
    public toJSON<T>(data: T): string {
        return JSON.stringify(data, null, 2);
    }

    // ─── Download (browser) ───────────────────────────────────────────────────

    /**
     * Trigger a file download in the browser.
     * In non-browser environments (e.g. Node/tests) this is a no-op.
     */
    private triggerDownload(content: string, filename: string, mimeType: string): void {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }

    // ─── Export ───────────────────────────────────────────────────────────────

    /**
     * Export a generic array of records.
     */
    public exportRecords<T extends Record<string, unknown>>(records: T[], options: ExportOptions): ExportResult {
        const { format, filename: baseFilename = 'analysis_export', includeHeaders = true } = options;
        const filename = this.generateFilename(baseFilename, format);
        const exportedAt = Date.now();

        try {
            if (format === 'csv') {
                const content = this.toCSV(records, includeHeaders);
                this.triggerDownload(content, filename, 'text/csv;charset=utf-8;');
            } else {
                const content = this.toJSON(records);
                this.triggerDownload(content, filename, 'application/json');
            }

            return { success: true, filename, format, recordCount: records.length, exportedAt };
        } catch (error) {
            return {
                success: false,
                filename,
                format,
                recordCount: 0,
                exportedAt,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Export a single analysis result object.
     */
    public exportAnalysis<T>(data: T, options: ExportOptions): ExportResult {
        const records = Array.isArray(data) ? (data as Record<string, unknown>[]) : [data as Record<string, unknown>];
        return this.exportRecords(records, options);
    }
}

export const analysisExportService = AnalysisExportService.getInstance();
