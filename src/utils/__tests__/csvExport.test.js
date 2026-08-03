import { vi } from 'vitest';
import { convertToCSV, downloadCSV, exportToCSV } from '../csvExport';

describe('csvExport utilities', () => {
  describe('convertToCSV', () => {
    const testData = [
      { id: 1, name: 'Product A', price: 10.99, category: { name: 'Electronics' } },
      { id: 2, name: 'Product B', price: 20.50, category: { name: 'Books' } },
      { id: 3, name: 'Product C', price: 5.00, category: { name: 'Toys' } },
    ];

    const simpleColumns = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'price', label: 'Price' },
    ];

    it('should convert data to CSV format', () => {
      const csv = convertToCSV(testData, simpleColumns);
      expect(csv).toContain('ID,Name,Price');
      expect(csv).toContain('1,Product A,10.99');
      expect(csv).toContain('2,Product B,20.5'); // JavaScript drops trailing zeros
      expect(csv).toContain('3,Product C,5');
    });

    it('should handle nested properties with dot notation', () => {
      const columns = [
        { key: 'name', label: 'Name' },
        { key: 'category.name', label: 'Category' },
      ];
      const csv = convertToCSV(testData, columns);
      expect(csv).toContain('Name,Category');
      expect(csv).toContain('Product A,Electronics');
      expect(csv).toContain('Product B,Books');
    });

    it('should use key as label if label is not provided', () => {
      const columns = [{ key: 'id' }, { key: 'name' }];
      const csv = convertToCSV(testData, columns);
      expect(csv).toContain('id,name');
    });

    it('should apply custom formatters', () => {
      const columns = [
        { key: 'name', label: 'Name' },
        {
          key: 'price',
          label: 'Price',
          format: (value) => `$${value.toFixed(2)}`,
        },
      ];
      const csv = convertToCSV(testData, columns);
      expect(csv).toContain('$10.99');
      expect(csv).toContain('$20.50');
      expect(csv).toContain('$5.00');
    });

    it('should escape values with commas', () => {
      const data = [{ name: 'Product, with comma', price: 10 }];
      const columns = [{ key: 'name', label: 'Name' }];
      const csv = convertToCSV(data, columns);
      expect(csv).toContain('"Product, with comma"');
    });

    it('should escape values with quotes', () => {
      const data = [{ name: 'Product "quoted"', price: 10 }];
      const columns = [{ key: 'name', label: 'Name' }];
      const csv = convertToCSV(data, columns);
      expect(csv).toContain('"Product ""quoted"""');
    });

    it('should escape values with newlines', () => {
      const data = [{ name: 'Product\nwith newline', price: 10 }];
      const columns = [{ key: 'name', label: 'Name' }];
      const csv = convertToCSV(data, columns);
      expect(csv).toContain('"Product\nwith newline"');
    });

    it('should handle null and undefined values', () => {
      const data = [
        { id: 1, name: null, price: undefined },
        { id: 2, name: '', price: 0 },
      ];
      const columns = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'price', label: 'Price' },
      ];
      const csv = convertToCSV(data, columns);
      expect(csv).toContain('1,,');
      expect(csv).toContain('2,,0');
    });

    it('should return empty string for empty data', () => {
      const csv = convertToCSV([], simpleColumns);
      expect(csv).toBe('');
    });

    it('should return empty string for null data', () => {
      const csv = convertToCSV(null, simpleColumns);
      expect(csv).toBe('');
    });

    it('should handle missing nested properties', () => {
      const data = [
        { name: 'Product A', category: { name: 'Electronics' } },
        { name: 'Product B' }, // Missing category
      ];
      const columns = [
        { key: 'name', label: 'Name' },
        { key: 'category.name', label: 'Category' },
      ];
      const csv = convertToCSV(data, columns);
      expect(csv).toContain('Product A,Electronics');
      expect(csv).toContain('Product B,');
    });
  });

  describe('downloadCSV', () => {
    let mockLink;
    let linkClickSpy;
    let appendChildSpy;
    let removeChildSpy;
    let originalCreateObjectURL;
    let originalRevokeObjectURL;

    beforeEach(() => {
      // Create a real DOM element so appendChild/removeChild work in jsdom
      mockLink = document.createElement('a');
      linkClickSpy = vi.spyOn(mockLink, 'click').mockImplementation();
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
      appendChildSpy = vi.spyOn(document.body, 'appendChild');
      removeChildSpy = vi.spyOn(document.body, 'removeChild');

      // Mock URL methods (jsdom doesn't have these)
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

    it('should create and download CSV file', () => {
      const csvContent = 'ID,Name\n1,Product A';
      const filename = 'test.csv';

      downloadCSV(csvContent, filename);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(linkClickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

  });

  describe('exportToCSV', () => {
    let mockLink;
    let linkClickSpy;
    let createElementSpy;
    let originalCreateObjectURL;
    let originalRevokeObjectURL;

    beforeEach(() => {
      // Create a real DOM element so appendChild/removeChild work in jsdom
      mockLink = document.createElement('a');
      linkClickSpy = vi.spyOn(mockLink, 'click').mockImplementation();
      createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);

      // Mock URL methods (jsdom doesn't have these)
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

    it('should export data to CSV successfully', () => {
      const data = [{ id: 1, name: 'Product A' }];
      const columns = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
      ];

      const result = exportToCSV(data, columns, 'test.csv');

      expect(result.success).toBe(true);
      expect(result.message).toBe('CSV exported successfully');
      expect(linkClickSpy).toHaveBeenCalled();
    });

    it('should use timestamped filename if none provided', () => {
      const data = [{ id: 1, name: 'Product A' }];
      const columns = [{ key: 'id', label: 'ID' }];

      const result = exportToCSV(data, columns);

      expect(result.success).toBe(true);
      expect(linkClickSpy).toHaveBeenCalled();
    });

    it('should return error when no data to export', () => {
      const result = exportToCSV([], [{ key: 'id', label: 'ID' }]);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No data to export');
      expect(linkClickSpy).not.toHaveBeenCalled();
    });

    it('should handle export errors', () => {
      const data = [{ id: 1, name: 'Product A' }];
      const columns = [{ key: 'id', label: 'ID' }];

      // Force an error by making createElement throw
      createElementSpy.mockImplementation(() => {
        throw new Error('DOM error');
      });

      const result = exportToCSV(data, columns, 'test.csv');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Export failed');
      expect(result.message).toContain('DOM error');
    });
  });
});
