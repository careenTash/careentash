import { AnalysisExportService } from '../analysis-export.service';
import type { ExportOptions } from '../../../types/analysis.types';

// Mock browser download APIs that are unavailable in jsdom
beforeAll(() => {
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
});

describe('AnalysisExportService', () => {
    let service: AnalysisExportService;

    beforeEach(() => {
        service = AnalysisExportService.getInstance();
    });

    it('returns the same singleton instance', () => {
        expect(service).toBe(AnalysisExportService.getInstance());
    });

    describe('toCSV', () => {
        it('returns empty string for no records', () => {
            expect(service.toCSV([])).toBe('');
        });

        it('includes headers by default', () => {
            const csv = service.toCSV([{ symbol: 'A', value: 1 }]);
            const lines = csv.split('\n');
            expect(lines[0]).toContain('symbol');
            expect(lines[0]).toContain('value');
        });

        it('omits headers when includeHeaders is false', () => {
            const csv = service.toCSV([{ symbol: 'A', value: 1 }], false);
            const lines = csv.split('\n');
            expect(lines[0]).not.toContain('symbol');
            expect(lines[0]).toContain('A');
        });

        it('wraps comma-containing values in quotes', () => {
            const csv = service.toCSV([{ name: 'hello, world' }]);
            expect(csv).toContain('"hello, world"');
        });

        it('flattens nested objects', () => {
            const csv = service.toCSV([{ outer: { inner: 42 } }]);
            expect(csv).toContain('outer.inner');
            expect(csv).toContain('42');
        });

        it('serialises arrays as JSON strings', () => {
            const csv = service.toCSV([{ items: [1, 2, 3] }]);
            expect(csv).toContain('[1,2,3]');
        });
    });

    describe('toJSON', () => {
        it('serialises data as formatted JSON', () => {
            const data = { symbol: 'TEST', value: 42 };
            const json = service.toJSON(data);
            expect(JSON.parse(json)).toEqual(data);
            expect(json).toContain('\n'); // formatted
        });
    });

    describe('exportRecords', () => {
        const csvOptions: ExportOptions = { format: 'csv', filename: 'test_export' };
        const jsonOptions: ExportOptions = { format: 'json', filename: 'test_export' };

        it('returns success for CSV export', () => {
            const records = [{ symbol: 'A', profit: 10 }];
            const result = service.exportRecords(records, csvOptions);
            expect(result.success).toBe(true);
            expect(result.format).toBe('csv');
            expect(result.recordCount).toBe(1);
            expect(result.filename).toMatch(/\.csv$/);
        });

        it('returns success for JSON export', () => {
            const records = [{ symbol: 'A', profit: 10 }];
            const result = service.exportRecords(records, jsonOptions);
            expect(result.success).toBe(true);
            expect(result.format).toBe('json');
            expect(result.recordCount).toBe(1);
            expect(result.filename).toMatch(/\.json$/);
        });

        it('uses default filename when none specified', () => {
            const result = service.exportRecords([{ a: 1 }], { format: 'csv' });
            expect(result.filename).toContain('analysis_export');
        });

        it('includes exportedAt timestamp', () => {
            const result = service.exportRecords([{ a: 1 }], csvOptions);
            expect(typeof result.exportedAt).toBe('number');
        });
    });

    describe('exportAnalysis', () => {
        it('wraps a single object in an array', () => {
            const result = service.exportAnalysis({ symbol: 'TEST' }, { format: 'json' });
            expect(result.success).toBe(true);
            expect(result.recordCount).toBe(1);
        });

        it('handles array input directly', () => {
            const result = service.exportAnalysis([{ a: 1 }, { b: 2 }], { format: 'csv' });
            expect(result.recordCount).toBe(2);
        });
    });
});
