import React, { useState, useCallback } from 'react';
import { X, Zap } from 'lucide-react';
import type { CouponDiscountType, CouponUpdateData, Coupon } from '../types';
import WooCommerceService from '../services/woocommerce';

interface BulkGenerateCouponsModalProps {
  service: WooCommerceService;
  onClose: () => void;
  onGenerated: (coupons: Coupon[]) => void;
}

interface BulkFormData {
  prefix: string;
  count: number;
  discount_type: CouponDiscountType;
  amount: string;
  description: string;
  date_expires: string;
  individual_use: boolean;
  usage_limit: string;
  usage_limit_per_user: string;
  free_shipping: boolean;
  minimum_amount: string;
  maximum_amount: string;
  exclude_sale_items: boolean;
}

const defaultBulkFormData: BulkFormData = {
  prefix: '',
  count: 10,
  discount_type: 'percent',
  amount: '',
  description: '',
  date_expires: '',
  individual_use: false,
  usage_limit: '',
  usage_limit_per_user: '',
  free_shipping: false,
  minimum_amount: '',
  maximum_amount: '',
  exclude_sale_items: false,
};

interface BulkFormErrors {
  amount?: string;
  date_expires?: string;
  usage_limit?: string;
  usage_limit_per_user?: string;
  minimum_amount?: string;
  maximum_amount?: string;
  prefix?: string;
}

function validateBulkForm(formData: BulkFormData): BulkFormErrors {
  const errors: BulkFormErrors = {};

  // Prefix: if provided, alphanumeric + hyphens only
  if (formData.prefix && !/^[A-Z0-9-]+$/.test(formData.prefix.trim())) {
    errors.prefix = 'Prefix can only contain letters, numbers, and hyphens';
  }

  // Amount: required, positive; if percent must be 1-100
  if (!formData.amount) {
    errors.amount = 'Discount amount is required';
  } else {
    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      errors.amount = 'Discount amount must be a positive number';
    } else if (formData.discount_type === 'percent' && (amt < 1 || amt > 100)) {
      errors.amount = 'Percentage discount must be between 1 and 100';
    }
  }

  // Expiry date: if provided, must be in the future
  if (formData.date_expires) {
    const expiry = new Date(formData.date_expires);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expiry < today) {
      errors.date_expires = 'Expiry date must be in the future';
    }
  }

  // Usage limit: if provided, must be a positive integer
  if (formData.usage_limit) {
    const limit = parseInt(formData.usage_limit);
    if (isNaN(limit) || limit < 1 || !Number.isInteger(limit)) {
      errors.usage_limit = 'Usage limit must be a positive whole number';
    }
  }

  // Usage limit per user: if provided, must be a positive integer
  if (formData.usage_limit_per_user) {
    const limit = parseInt(formData.usage_limit_per_user);
    if (isNaN(limit) || limit < 1 || !Number.isInteger(limit)) {
      errors.usage_limit_per_user = 'Usage limit per user must be a positive whole number';
    }
  }

  // Minimum spend: if provided, must be non-negative
  if (formData.minimum_amount) {
    const min = parseFloat(formData.minimum_amount);
    if (isNaN(min) || min < 0) {
      errors.minimum_amount = 'Minimum spend must be a positive number';
    }
  }

  // Maximum spend: if provided, must be positive and > minimum
  if (formData.maximum_amount) {
    const max = parseFloat(formData.maximum_amount);
    if (isNaN(max) || max <= 0) {
      errors.maximum_amount = 'Maximum spend must be a positive number';
    } else if (formData.minimum_amount) {
      const min = parseFloat(formData.minimum_amount);
      if (!isNaN(min) && max <= min) {
        errors.maximum_amount = 'Maximum spend must be greater than minimum spend';
      }
    }
  }

  return errors;
}

function generateRandomCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateUniqueCodes(prefix: string, count: number): string[] {
  const codes = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 10;

  while (codes.size < count && attempts < maxAttempts) {
    codes.add(`${prefix}${generateRandomCode(6)}`);
    attempts++;
  }

  return Array.from(codes);
}

function BulkGenerateCouponsModal({
  service,
  onClose,
  onGenerated,
}: BulkGenerateCouponsModalProps): React.ReactElement {
  const [formData, setFormData] = useState<BulkFormData>(defaultBulkFormData);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const [formErrors, setFormErrors] = useState<BulkFormErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const updateFormData = useCallback((updates: Partial<BulkFormData>): void => {
    setFormData((prev) => {
      const next = { ...prev, ...updates };
      setFormErrors(() => {
        const newErrors = validateBulkForm(next);
        const filtered: BulkFormErrors = {};
        (Object.keys(newErrors) as (keyof BulkFormErrors)[]).forEach((key) => {
          if (touchedFields.has(key)) {
            filtered[key] = newErrors[key];
          }
        });
        return filtered;
      });
      return next;
    });
  }, [touchedFields]);

  const handleFieldBlur = useCallback((field: keyof BulkFormErrors): void => {
    setTouchedFields((prev) => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
    setFormData((currentData) => {
      const errors = validateBulkForm(currentData);
      setFormErrors((prevErrors) => {
        const updated = { ...prevErrors };
        if (errors[field]) {
          updated[field] = errors[field];
        } else {
          delete updated[field];
        }
        return updated;
      });
      return currentData;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (formData.count < 1) return;

    // Run full validation on submit
    const allFields: (keyof BulkFormErrors)[] = [
      'amount', 'date_expires', 'usage_limit', 'usage_limit_per_user',
      'minimum_amount', 'maximum_amount', 'prefix',
    ];
    setTouchedFields(new Set(allFields));
    const errors = validateBulkForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setGenerating(true);
    setProgress(0);
    setResult(null);

    const codes = generateUniqueCodes(
      formData.prefix ? `${formData.prefix.toUpperCase().replace(/\s+/g, '')}-` : '',
      formData.count
    );

    const baseCouponData: Omit<CouponUpdateData, 'code'> = {
      discount_type: formData.discount_type,
      amount: formData.amount,
      description: formData.description,
      date_expires: formData.date_expires ? `${formData.date_expires}T23:59:59` : null,
      individual_use: formData.individual_use,
      usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
      usage_limit_per_user: formData.usage_limit_per_user
        ? parseInt(formData.usage_limit_per_user)
        : null,
      free_shipping: formData.free_shipping,
      minimum_amount: formData.minimum_amount,
      maximum_amount: formData.maximum_amount,
      exclude_sale_items: formData.exclude_sale_items,
    };

    const allCoupons: CouponUpdateData[] = codes.map((code) => ({
      ...baseCouponData,
      code,
    }));

    // Split into batches of 100 (WooCommerce batch limit)
    const batchSize = 100;
    const batches: CouponUpdateData[][] = [];
    for (let i = 0; i < allCoupons.length; i += batchSize) {
      batches.push(allCoupons.slice(i, i + batchSize));
    }

    let successCount = 0;
    let failedCount = 0;
    const createdCoupons: Coupon[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) continue;
      const batchResult = await service.batchCreateCoupons(batch);

      if (batchResult.success && batchResult.data?.create) {
        successCount += batchResult.data.create.length;
        createdCoupons.push(...(batchResult.data.create as Coupon[]));
      } else {
        failedCount += batch.length;
      }

      setProgress(Math.round(((i + 1) / batches.length) * 100));
    }

    setResult({ success: successCount, failed: failedCount });
    setGenerating(false);

    if (createdCoupons.length > 0) {
      onGenerated(createdCoupons);
    }
  }, [formData, service, onGenerated]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Bulk Generate Coupons
              </h3>
            </div>
            <button
              onClick={onClose}
              disabled={generating}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {result ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-lg font-semibold text-green-800 dark:text-green-300">
                  Generation Complete
                </p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  Successfully created: <strong>{result.success}</strong> coupons
                </p>
                {result.failed > 0 && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    Failed: <strong>{result.failed}</strong> coupons
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Count and Prefix */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="bulk-count"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Number of Coupons *
                  </label>
                  <input
                    id="bulk-count"
                    type="number"
                    min={1}
                    max={100}
                    value={formData.count}
                    onChange={(e) =>
                      updateFormData({
                        count: Math.min(100, Math.max(1, parseInt(e.target.value) || 1)),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="bulk-prefix"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Code Prefix
                  </label>
                  <input
                    id="bulk-prefix"
                    type="text"
                    value={formData.prefix}
                    onChange={(e) =>
                      updateFormData({ prefix: e.target.value.toUpperCase() })
                    }
                    onBlur={() => handleFieldBlur('prefix')}
                    placeholder="e.g., SUMMER"
                    className={`w-full px-3 py-2 border ${formErrors.prefix ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono uppercase`}
                  />
                  {formErrors.prefix
                    ? <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.prefix}</p>
                    : <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Codes will be: {formData.prefix ? `${formData.prefix}-` : ''}XXXXXX
                      </p>
                  }
                </div>
              </div>

              {/* Type and Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="bulk-discount-type"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Discount Type
                  </label>
                  <select
                    id="bulk-discount-type"
                    value={formData.discount_type}
                    onChange={(e) =>
                      updateFormData({
                        discount_type: e.target.value as CouponDiscountType,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="percent">Percentage discount</option>
                    <option value="fixed_cart">Fixed cart discount</option>
                    <option value="fixed_product">Fixed product discount</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="bulk-amount"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Amount *
                  </label>
                  <input
                    id="bulk-amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => updateFormData({ amount: e.target.value })}
                    onBlur={() => handleFieldBlur('amount')}
                    placeholder={formData.discount_type === 'percent' ? 'e.g., 20' : 'e.g., 10.00'}
                    className={`w-full px-3 py-2 border ${formErrors.amount ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500`}
                  />
                  {formErrors.amount && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.amount}</p>}
                </div>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="bulk-description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Description
                </label>
                <input
                  id="bulk-description"
                  type="text"
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  placeholder="Internal description for these coupons"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Expiry Date */}
              <div>
                <label
                  htmlFor="bulk-date-expires"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Expiry Date
                </label>
                <input
                  id="bulk-date-expires"
                  type="date"
                  value={formData.date_expires}
                  onChange={(e) => updateFormData({ date_expires: e.target.value })}
                  onBlur={() => handleFieldBlur('date_expires')}
                  className={`w-full px-3 py-2 border ${formErrors.date_expires ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500`}
                />
                {formErrors.date_expires && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.date_expires}</p>}
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="bulk-usage-limit"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Usage Limit (Total)
                  </label>
                  <input
                    id="bulk-usage-limit"
                    type="number"
                    value={formData.usage_limit}
                    onChange={(e) => updateFormData({ usage_limit: e.target.value })}
                    onBlur={() => handleFieldBlur('usage_limit')}
                    placeholder="Unlimited"
                    className={`w-full px-3 py-2 border ${formErrors.usage_limit ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500`}
                  />
                  {formErrors.usage_limit && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.usage_limit}</p>}
                </div>
                <div>
                  <label
                    htmlFor="bulk-usage-limit-per-user"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Usage Limit (Per User)
                  </label>
                  <input
                    id="bulk-usage-limit-per-user"
                    type="number"
                    value={formData.usage_limit_per_user}
                    onChange={(e) =>
                      updateFormData({ usage_limit_per_user: e.target.value })
                    }
                    onBlur={() => handleFieldBlur('usage_limit_per_user')}
                    placeholder="Unlimited"
                    className={`w-full px-3 py-2 border ${formErrors.usage_limit_per_user ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500`}
                  />
                  {formErrors.usage_limit_per_user && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.usage_limit_per_user}</p>}
                </div>
              </div>

              {/* Min/Max Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="bulk-minimum-amount"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Minimum Spend
                  </label>
                  <input
                    id="bulk-minimum-amount"
                    type="number"
                    step="0.01"
                    value={formData.minimum_amount}
                    onChange={(e) => updateFormData({ minimum_amount: e.target.value })}
                    onBlur={() => handleFieldBlur('minimum_amount')}
                    placeholder="No minimum"
                    className={`w-full px-3 py-2 border ${formErrors.minimum_amount ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500`}
                  />
                  {formErrors.minimum_amount && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.minimum_amount}</p>}
                </div>
                <div>
                  <label
                    htmlFor="bulk-maximum-amount"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Maximum Spend
                  </label>
                  <input
                    id="bulk-maximum-amount"
                    type="number"
                    step="0.01"
                    value={formData.maximum_amount}
                    onChange={(e) => updateFormData({ maximum_amount: e.target.value })}
                    onBlur={() => handleFieldBlur('maximum_amount')}
                    placeholder="No maximum"
                    className={`w-full px-3 py-2 border ${formErrors.maximum_amount ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500`}
                  />
                  {formErrors.maximum_amount && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.maximum_amount}</p>}
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.individual_use}
                    onChange={(e) =>
                      updateFormData({ individual_use: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Individual use only
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.free_shipping}
                    onChange={(e) =>
                      updateFormData({ free_shipping: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Allow free shipping
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.exclude_sale_items}
                    onChange={(e) =>
                      updateFormData({ exclude_sale_items: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Exclude sale items
                  </span>
                </label>
              </div>

              {/* Progress Bar */}
              {generating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Generating coupons...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleGenerate}
                  disabled={generating || formData.count < 1 || Object.keys(formErrors).length > 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  {generating ? 'Generating...' : `Generate ${formData.count} Coupons`}
                </button>
                <button
                  onClick={onClose}
                  disabled={generating}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(BulkGenerateCouponsModal);
