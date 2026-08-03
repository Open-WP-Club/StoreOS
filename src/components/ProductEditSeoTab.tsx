import React, { ChangeEvent, useMemo } from 'react';
import { Globe, Search, Info } from 'lucide-react';
import type { ProductFormData } from '../hooks/useProductEditForm';

interface ProductEditSeoTabProps {
  formData: ProductFormData;
  storeUrl?: string;
  onInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}

/** Converts a string to a WooCommerce-style slug */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Truncate with ellipsis */
function truncate(str: string, max: number): { text: string; truncated: boolean } {
  if (str.length <= max) return { text: str, truncated: false };
  return { text: str.slice(0, max), truncated: true };
}

export default function ProductEditSeoTab({
  formData,
  storeUrl,
  onInputChange,
}: ProductEditSeoTabProps): React.ReactElement {
  const baseUrl = storeUrl
    ? storeUrl.replace(/\/$/, '')
    : 'https://yourstore.com';

  const effectiveSlug = formData.slug || toSlug(formData.name) || 'product-name';

  const productUrl = `${baseUrl}/product/${effectiveSlug}`;
  const displayUrl = productUrl.length > 60
    ? productUrl.slice(0, 57) + '...'
    : productUrl;

  // SERP preview values — use product name/description as fallbacks
  const serpTitle = truncate(formData.name || 'Product name', 60);
  const serpDesc = truncate(
    formData.short_description
      ? formData.short_description.replace(/<[^>]+>/g, '').trim()
      : formData.description
        ? formData.description.replace(/<[^>]+>/g, '').trim()
        : 'Product description will appear here.',
    160
  );

  const slugBarWidth = useMemo(() => {
    const len = (formData.slug || toSlug(formData.name) || '').length;
    if (len === 0) return 0;
    if (len > 75) return 100;
    return Math.round((len / 75) * 100);
  }, [formData.slug, formData.name]);

  const slugBarColor =
    slugBarWidth === 0 ? 'bg-gray-200 dark:bg-gray-600' :
    slugBarWidth <= 60 ? 'bg-green-500' :
    slugBarWidth <= 85 ? 'bg-yellow-500' :
    'bg-red-500';

  const handleSlugChange = (e: ChangeEvent<HTMLInputElement>): void => {
    // Auto-sanitize on change
    const sanitized = toSlug(e.target.value);
    // Fire synthetic event so handleInputChange works without modification
    const syntheticEvent = {
      ...e,
      target: { ...e.target, name: 'slug', value: sanitized },
      currentTarget: { ...e.currentTarget, name: 'slug', value: sanitized },
    } as ChangeEvent<HTMLInputElement>;
    onInputChange(syntheticEvent);
  };

  return (
    <div className="space-y-8">
      {/* Section header */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-500" />
          Search Engine Optimization
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Control how this product appears in search engine results.
        </p>
      </div>

      {/* Slug field */}
      <div>
        <label
          htmlFor="seo-slug"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          URL Slug
        </label>
        <div className="flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
          <span className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 shrink-0 select-none">
            /product/
          </span>
          <input
            id="seo-slug"
            type="text"
            name="slug"
            value={formData.slug}
            onChange={handleSlugChange}
            placeholder={toSlug(formData.name) || 'product-name'}
            className="flex-1 px-3 py-2 text-sm text-gray-900 dark:text-white bg-transparent focus:outline-none"
          />
        </div>
        {/* Slug length bar */}
        <div className="mt-1.5">
          <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${slugBarColor}`}
              style={{ width: `${slugBarWidth}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {formData.slug.length > 0
              ? `${formData.slug.length} characters — ${formData.slug.length <= 75 ? 'good length' : 'consider shortening'}`
              : 'Leave blank to auto-generate from product name'}
          </p>
        </div>
      </div>

      {/* Meta fields note */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
              Meta title &amp; description
            </p>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
              Meta title and description are managed by your SEO plugin (Yoast SEO or Rank Math).
              If installed, edit them directly in your WordPress admin under the product editor SEO panel.
              The SERP preview below uses the product name and description as fallbacks.
            </p>
          </div>
        </div>
      </div>

      {/* Live SERP Preview */}
      <div>
        <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Google Search Preview
        </div>

        {/* Google SERP mock */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 max-w-[600px]">
          {/* Title */}
          <div
            className="text-[20px] leading-snug font-normal text-[#1a0dab] dark:text-blue-400 hover:underline cursor-pointer truncate"
            title={formData.name}
          >
            {serpTitle.text}
            {serpTitle.truncated && (
              <span className="text-gray-400"> ...</span>
            )}
          </div>

          {/* URL breadcrumb */}
          <div className="text-[14px] text-[#006621] dark:text-green-400 mt-0.5 truncate">
            {displayUrl}
          </div>

          {/* Description snippet */}
          <div className="text-[14px] text-[#545454] dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
            {serpDesc.text}
            {serpDesc.truncated && '…'}
          </div>
        </div>

        {/* Character count hints */}
        <div className="mt-3 grid grid-cols-2 gap-4 max-w-[600px]">
          <div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Title length</span>
              <span className={serpTitle.text.length > 55 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
                {serpTitle.text.length} / 60
              </span>
            </div>
            <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${serpTitle.text.length > 55 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min((serpTitle.text.length / 60) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Description length</span>
              <span className={serpDesc.text.length > 145 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
                {serpDesc.text.length} / 160
              </span>
            </div>
            <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${serpDesc.text.length > 145 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min((serpDesc.text.length / 160) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          Preview uses product name and description as title/snippet. Install Yoast or Rank Math to set custom meta tags.
        </p>
      </div>
    </div>
  );
}
