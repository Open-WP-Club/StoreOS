/**
 * Date and time formatting utilities
 * Enhanced with Temporal API support (Chromium 144+, Node.js 24+)
 */

// ============================================
// Types
// ============================================

type DateInput = string | Date | null | undefined;

interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  year?: 'numeric' | '2-digit';
  month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow';
  day?: 'numeric' | '2-digit';
  hour?: 'numeric' | '2-digit';
  minute?: 'numeric' | '2-digit';
  second?: 'numeric' | '2-digit';
}

interface DateRange {
  start: Date;
  end: Date;
}

// Check if Temporal API is available
const hasTemporalAPI = typeof globalThis.Temporal !== 'undefined';

// ============================================
// Functions
// ============================================

/**
 * Format a date string or Date object to user's locale date format
 */
export const formatDate = (date: DateInput, options: DateFormatOptions = {}): string => {
  if (!date) return '';

  const defaultOptions: DateFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };

  return new Date(date).toLocaleDateString(undefined, defaultOptions);
};

/**
 * Format a date string or Date object to user's locale date and time format
 */
export const formatDateTime = (dateTime: DateInput, options: DateFormatOptions = {}): string => {
  if (!dateTime) return '';

  const defaultOptions: DateFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  return new Date(dateTime).toLocaleString(undefined, defaultOptions);
};

/**
 * Format a date string or Date object to user's locale time format
 */
export const formatTime = (time: DateInput, options: DateFormatOptions = {}): string => {
  if (!time) return '';

  const defaultOptions: DateFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  return new Date(time).toLocaleTimeString(undefined, defaultOptions);
};

/**
 * Get relative time string (e.g., "2 hours ago", "3 days ago")
 */
export const getRelativeTime = (date: DateInput): string => {
  if (!date) return '';

  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
};

// ============================================
// Temporal API Functions (Chromium 144+, Node.js 24+)
// ============================================

/**
 * Get the current instant as ISO string using Temporal API
 * Falls back to Date if Temporal is not available
 */
export const nowISO = (): string => {
  if (hasTemporalAPI) {
    return Temporal.Now.instant().toString();
  }
  return new Date().toISOString();
};

/**
 * Get today's date as YYYY-MM-DD string using Temporal API
 */
export const todayString = (): string => {
  if (hasTemporalAPI) {
    return Temporal.Now.plainDateISO().toString();
  }
  return new Date().toISOString().split('T')[0] ?? '';
};

/**
 * Parse an ISO date string to a plain date string (YYYY-MM-DD)
 * Uses Temporal API for more accurate parsing
 */
export const toPlainDate = (date: DateInput): string | null => {
  if (!date) return null;

  try {
    if (hasTemporalAPI) {
      const instant = Temporal.Instant.from(
        typeof date === 'string' ? date : date.toISOString()
      );
      return instant.toZonedDateTimeISO(Temporal.Now.timeZoneId()).toPlainDate().toString();
    }
    return new Date(date).toISOString().split('T')[0] ?? null;
  } catch {
    return null;
  }
};

/**
 * Calculate the difference between two dates in days
 * Uses Temporal API for precise calculation
 */
export const daysBetween = (startDate: DateInput, endDate: DateInput): number | null => {
  if (!startDate || !endDate) return null;

  try {
    if (hasTemporalAPI) {
      const start = Temporal.PlainDate.from(
        typeof startDate === 'string' ? (startDate.split('T')[0] ?? '') : (startDate.toISOString().split('T')[0] ?? '')
      );
      const end = Temporal.PlainDate.from(
        typeof endDate === 'string' ? (endDate.split('T')[0] ?? '') : (endDate.toISOString().split('T')[0] ?? '')
      );
      return start.until(end, { largestUnit: 'day' }).days;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

/**
 * Add days to a date and return as ISO string
 */
export const addDays = (date: DateInput, days: number): string | null => {
  if (!date) return null;

  try {
    if (hasTemporalAPI) {
      const plainDate = Temporal.PlainDate.from(
        typeof date === 'string' ? (date.split('T')[0] ?? '') : (date.toISOString().split('T')[0] ?? '')
      );
      return plainDate.add({ days }).toString();
    }

    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0] ?? null;
  } catch {
    return null;
  }
};

/**
 * Get date ranges for common periods (last 7 days, last 30 days, etc.)
 */
export const getDateRange = (
  period: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth'
): DateRange => {
  const now = new Date();

  if (hasTemporalAPI) {
    const today = Temporal.Now.plainDateISO();

    switch (period) {
      case 'today':
        return {
          start: new Date(today.toString()),
          end: new Date(today.toString()),
        };
      case 'yesterday': {
        const yesterday = today.subtract({ days: 1 });
        return {
          start: new Date(yesterday.toString()),
          end: new Date(yesterday.toString()),
        };
      }
      case 'last7days':
        return {
          start: new Date(today.subtract({ days: 6 }).toString()),
          end: new Date(today.toString()),
        };
      case 'last30days':
        return {
          start: new Date(today.subtract({ days: 29 }).toString()),
          end: new Date(today.toString()),
        };
      case 'thisMonth': {
        const firstOfMonth = today.with({ day: 1 });
        return {
          start: new Date(firstOfMonth.toString()),
          end: new Date(today.toString()),
        };
      }
      case 'lastMonth': {
        const firstOfLastMonth = today.subtract({ months: 1 }).with({ day: 1 });
        const lastOfLastMonth = today.with({ day: 1 }).subtract({ days: 1 });
        return {
          start: new Date(firstOfLastMonth.toString()),
          end: new Date(lastOfLastMonth.toString()),
        };
      }
    }
  }

  // Fallback to Date API
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: yesterday };
    }
    case 'last7days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start, end: today };
    }
    case 'last30days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { start, end: today };
    }
    case 'thisMonth': {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: firstOfMonth, end: today };
    }
    case 'lastMonth': {
      const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: firstOfLastMonth, end: lastOfLastMonth };
    }
  }
};

/**
 * Check if Temporal API is available in the current environment
 */
export const isTemporalAvailable = (): boolean => hasTemporalAPI;

/**
 * Format duration in a human-readable format
 */
export const formatDuration = (seconds: number): string => {
  if (hasTemporalAPI) {
    const duration = Temporal.Duration.from({ seconds: Math.floor(seconds) });
    const { hours, minutes, seconds: secs } = duration.round({ largestUnit: 'hour' });

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  // Fallback
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};
