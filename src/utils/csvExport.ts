/**
 * Utility functions for exporting data to CSV format
 */

// ============================================
// Types
// ============================================

export interface CSVColumn<T = unknown> {
  key: string;
  label?: string;
  format?: (value: unknown, item: T) => string;
}

export interface ExportResult {
  success: boolean;
  message: string;
}

// ============================================
// Functions
// ============================================

/**
 * Escape CSV value (handle quotes, commas, newlines)
 */
function escapeCSVValue(value: unknown): string {
  if (value == null) {
    return '';
  }

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert array of objects to CSV string
 */
export function convertToCSV<T extends object>(
  data: T[],
  columns: CSVColumn<T>[]
): string {
  if (!data || data.length === 0) {
    return '';
  }

  // Create header row
  const headers = columns.map(col => col.label || col.key);
  const headerRow = headers.map(escapeCSVValue).join(',');

  // Create data rows
  const dataRows = data.map(item => {
    return columns.map(col => {
      let value: unknown = col.key.split('.').reduce(
        (obj: Record<string, unknown> | undefined, key: string) => obj?.[key] as Record<string, unknown> | undefined,
        item as unknown as Record<string, unknown>
      );

      // Handle special formatting
      if (col.format && typeof col.format === 'function') {
        value = col.format(value, item);
      }

      return escapeCSVValue(value);
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  // Modern browsers
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Export data to CSV file
 */
export function exportToCSV<T extends object>(
  data: T[],
  columns: CSVColumn<T>[],
  filename?: string
): ExportResult {
  const csvContent = convertToCSV(data, columns);

  if (!csvContent) {
    return { success: false, message: 'No data to export' };
  }

  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const finalFilename = filename || `export-${timestamp}.csv`;

    downloadCSV(csvContent, finalFilename);
    return { success: true, message: 'CSV exported successfully' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: `Export failed: ${errorMessage}` };
  }
}
