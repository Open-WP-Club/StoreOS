/**
 * Date and time formatting utilities
 * Enhanced with Temporal API support (Chromium 144+, Node.js 24+)
 */

import useAppSettings from '../stores/appSettingsStore';

/** BCP-47 locale for the app language setting (bg -> bg-BG, the historic default). */
export function getAppLocale(): string {
  return useAppSettings.getState().language === 'en' ? 'en-GB' : 'bg-BG';
}

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
 * Parse an ISO date string to a plain date string (YYYY-MM-DD)
 * Uses Temporal API for more accurate parsing
 */
export const toPlainDate = (date: DateInput): string | null => {
  if (!date) return null;

  try {
    if (hasTemporalAPI) {
      const instant = Temporal.Instant.from(typeof date === 'string' ? date : date.toISOString());
      return instant.toZonedDateTimeISO(Temporal.Now.timeZoneId()).toPlainDate().toString();
    }
    return new Date(date).toISOString().split('T')[0] ?? null;
  } catch {
    return null;
  }
};

/** "Jan 5" style short date (en-US). */
export const formatShortDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
