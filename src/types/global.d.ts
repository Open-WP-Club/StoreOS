/**
 * Global type declarations for new platform APIs
 * These types are for Temporal API (Chromium 144+, Node.js 24+) and URLPattern
 */

// CSS module side-effect imports (e.g. import './index.css')
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// ============================================
// Temporal API Type Declarations
// ============================================

declare namespace Temporal {
  export class Instant {
    static from(item: string | Instant): Instant;
    toString(): string;
    toZonedDateTimeISO(timeZone: string): ZonedDateTime;
    epochMilliseconds: number;
    epochNanoseconds: bigint;
  }

  export class ZonedDateTime {
    static from(item: string | ZonedDateTime): ZonedDateTime;
    toString(): string;
    toPlainDate(): PlainDate;
    toPlainTime(): PlainTime;
    toPlainDateTime(): PlainDateTime;
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
  }

  export class PlainDate {
    static from(item: string | PlainDate | { year: number; month: number; day: number }): PlainDate;
    toString(): string;
    toLocaleString(locale?: string, options?: Intl.DateTimeFormatOptions): string;
    add(duration: DurationLike): PlainDate;
    subtract(duration: DurationLike): PlainDate;
    until(other: PlainDate, options?: { largestUnit?: string }): Duration;
    with(fields: { year?: number; month?: number; day?: number }): PlainDate;
    year: number;
    month: number;
    day: number;
    dayOfWeek: number;
    dayOfYear: number;
    weekOfYear: number;
    daysInMonth: number;
    daysInYear: number;
  }

  export class PlainTime {
    static from(item: string | PlainTime): PlainTime;
    toString(): string;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
  }

  export class PlainDateTime {
    static from(item: string | PlainDateTime): PlainDateTime;
    toString(): string;
    toPlainDate(): PlainDate;
    toPlainTime(): PlainTime;
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  }

  export class Duration {
    static from(item: string | DurationLike): Duration;
    toString(): string;
    round(options: { largestUnit?: string; smallestUnit?: string }): Duration;
    years: number;
    months: number;
    weeks: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    milliseconds: number;
  }

  export interface DurationLike {
    years?: number;
    months?: number;
    weeks?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
  }

  export namespace Now {
    export function instant(): Instant;
    export function plainDateISO(): PlainDate;
    export function plainTimeISO(): PlainTime;
    export function plainDateTimeISO(): PlainDateTime;
    export function zonedDateTimeISO(): ZonedDateTime;
    export function timeZoneId(): string;
  }
}

// Make Temporal available on globalThis
declare interface GlobalThis {
  Temporal: typeof Temporal;
}

// ============================================
// URLPattern API Type Declarations (already in lib.dom.d.ts for newer TS)
// But we declare it here for completeness
// ============================================

interface URLPatternInit {
  protocol?: string;
  username?: string;
  password?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  search?: string;
  hash?: string;
  baseURL?: string;
}

interface URLPatternResult {
  inputs: [URLPatternInit | string, string?];
  protocol: URLPatternComponentResult;
  username: URLPatternComponentResult;
  password: URLPatternComponentResult;
  hostname: URLPatternComponentResult;
  port: URLPatternComponentResult;
  pathname: URLPatternComponentResult;
  search: URLPatternComponentResult;
  hash: URLPatternComponentResult;
}

interface URLPatternComponentResult {
  input: string;
  groups: Record<string, string | undefined>;
}

declare class URLPattern {
  constructor(input?: URLPatternInit | string, baseURL?: string);
  test(input?: URLPatternInit | string, baseURL?: string): boolean;
  exec(input?: URLPatternInit | string, baseURL?: string): URLPatternResult | null;
  readonly protocol: string;
  readonly username: string;
  readonly password: string;
  readonly hostname: string;
  readonly port: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

// ============================================
// IndexedDB Transaction Options Extension
// ============================================

interface IDBTransactionOptions {
  durability?: 'default' | 'strict' | 'relaxed';
}

// Extend IDBDatabase to support transaction options
interface IDBDatabase {
  transaction(
    storeNames: string | string[],
    mode?: IDBTransactionMode,
    options?: IDBTransactionOptions
  ): IDBTransaction;
}
