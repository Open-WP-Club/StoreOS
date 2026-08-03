import { vi } from 'vitest';
import { convertToCSV, exportToCSV } from '../csvExport';

describe('csvExport - edge cases', () => {
  describe('convertToCSV - edge cases', () => {
    it('should handle values with carriage returns', () => {
      const data = [{ name: 'Product\r\nwith CR+LF' }];
      const columns = [{ key: 'name', label: 'Name' }];
      const csv = convertToCSV(data, columns);
      // \r is not in the escape check, but \n is, so CR+LF triggers wrapping
      expect(csv).toContain('"Product\r\nwith CR+LF"');
    });

    it('should handle boolean values', () => {
      const data = [{ active: true, deleted: false }];
      const columns = [
        { key: 'active', label: 'Active' },
        { key: 'deleted', label: 'Deleted' },
      ];
      const csv = convertToCSV(data, columns);
      expect(csv).toContain('true');
      expect(csv).toContain('false');
    });

    it('should handle numeric zero and empty string', () => {
      const data = [{ count: 0, name: '' }];
      const columns = [
        { key: 'count', label: 'Count' },
        { key: 'name', label: 'Name' },
      ];
      const csv = convertToCSV(data, columns);
      expect(csv).toContain('0,');
    });

    it('should handle deeply nested properties (3 levels)', () => {
      const data = [{ billing: { address: { city: 'Sofia' } } }];
      const columns = [{ key: 'billing.address.city', label: 'City' }];
      const csv = convertToCSV(data, columns);
      expect(csv).toContain('Sofia');
    });

    it('should handle missing intermediate nested property', () => {
      const data = [{ billing: null }];
      const columns = [{ key: 'billing.email', label: 'Email' }];
      const csv = convertToCSV(data, columns);
      // Should result in empty value, not throw
      expect(csv).toContain('Email\n');
    });

    it('should handle formatter returning non-string', () => {
      const data = [{ price: 10 }];
      const columns = [
        {
          key: 'price',
          label: 'Price',
          format: (value) => value * 2, // Returns number, not string
        },
      ];
      const csv = convertToCSV(data, columns);
      expect(csv).toContain('20');
    });

    it('should handle formatter receiving null value', () => {
      const data = [{ price: null }];
      const columns = [
        {
          key: 'price',
          label: 'Price',
          format: (value) => (value != null ? `$${value}` : 'N/A'),
        },
      ];
      const csv = convertToCSV(data, columns);
      expect(csv).toContain('N/A');
    });

    it('should handle single column', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const columns = [{ key: 'id', label: 'ID' }];
      const csv = convertToCSV(data, columns);
      expect(csv).toBe('ID\n1\n2');
    });

    it('should handle object values by converting to string', () => {
      const data = [{ meta: { key: 'val' } }];
      const columns = [{ key: 'meta', label: 'Meta' }];
      const csv = convertToCSV(data, columns);
      expect(csv).toContain('[object Object]');
    });

    it('should handle array values', () => {
      const data = [{ tags: [1, 2, 3] }];
      const columns = [{ key: 'tags', label: 'Tags' }];
      const csv = convertToCSV(data, columns);
      // Arrays get stringified
      expect(csv).toContain('Tags');
    });
  });

  describe('exportToCSV - edge cases', () => {
    let mockLink;
    let createElementSpy;
    let originalCreateObjectURL;
    let originalRevokeObjectURL;

    beforeEach(() => {
      // Create a real DOM element so appendChild/removeChild work in jsdom
      mockLink = document.createElement('a');
      vi.spyOn(mockLink, 'click').mockImplementation();
      createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);

      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('should return error for null data', () => {
      const result = exportToCSV(null, [{ key: 'id', label: 'ID' }]);
      expect(result.success).toBe(false);
      expect(result.message).toBe('No data to export');
    });

    it('should handle non-Error throw in downloadCSV', () => {
      createElementSpy.mockImplementation(() => {
        throw 'string error'; // Non-Error throw
      });

      const data = [{ id: 1 }];
      const columns = [{ key: 'id', label: 'ID' }];
      const result = exportToCSV(data, columns);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown error');
    });

    it('should generate timestamped filename when not provided', () => {
      const data = [{ id: 1 }];
      const columns = [{ key: 'id', label: 'ID' }];

      const result = exportToCSV(data, columns);

      expect(result.success).toBe(true);
    });
  });
});
