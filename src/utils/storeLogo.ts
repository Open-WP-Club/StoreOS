/**
 * Store logo lookup. Reads the public WordPress REST root (no credentials are ever sent) and
 * returns an image URL to render via <img src>. Result is cached per store in localStorage.
 */
import { normalizeStoreUrl } from './urlPatterns';

const CACHE_PREFIX = 'storeos-logo:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;

// Accept only https image URLs (http only when the store itself is http).
function safeImageUrl(candidate: unknown, base: URL): string | null {
  if (typeof candidate !== 'string' || !candidate || candidate.length > 2048) return null;
  try {
    const u = new URL(candidate, base);
    if (u.protocol === 'https:' || (u.protocol === 'http:' && base.protocol === 'http:')) {
      return u.href;
    }
  } catch {
    // fall through
  }
  return null;
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(url, {
    credentials: 'omit',
    redirect: 'error',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > 1_000_000) return null; // cap size of the root document
  const data: unknown = await res.json();
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
}

/** Returns the store's logo/site-icon URL, or null if none is available. Never throws. */
export async function fetchStoreLogo(storeUrl: string): Promise<string | null> {
  const normalized = normalizeStoreUrl(storeUrl);
  if (!normalized) return null;
  try {
    const base = new URL(normalized);
    const root = await getJson(`${normalized}/wp-json/`);
    if (!root) return null;

    const logoId = root.site_logo;
    if (typeof logoId === 'number' && logoId > 0) {
      try {
        const media = await getJson(`${normalized}/wp-json/wp/v2/media/${logoId}`);
        const fromMedia = safeImageUrl(media?.source_url, base);
        if (fromMedia) return fromMedia;
      } catch {
        // fall back to site icon
      }
    }
    return safeImageUrl(root.site_icon_url, base);
  } catch {
    return null;
  }
}

interface LogoCacheEntry {
  storeUrl: string;
  logo: string | null;
  at: number;
}

/** Cached lookup: refetches at most once a day or when the store URL changes. */
export async function getStoreLogo(storeId: string, storeUrl: string): Promise<string | null> {
  const key = CACHE_PREFIX + storeId;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const entry = JSON.parse(raw) as LogoCacheEntry;
      if (entry.storeUrl === storeUrl && Date.now() - entry.at < CACHE_TTL_MS) return entry.logo;
    }
  } catch {
    // ignore corrupt cache
  }
  const logo = await fetchStoreLogo(storeUrl);
  try {
    localStorage.setItem(key, JSON.stringify({ storeUrl, logo, at: Date.now() }));
  } catch {
    // storage full/unavailable: skip caching
  }
  return logo;
}
