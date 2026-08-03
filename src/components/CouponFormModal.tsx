import React from 'react';
import { X, Shuffle } from 'lucide-react';
import type { Coupon, CouponDiscountType } from '../types';
import type { CouponFormData, CouponFormErrors } from '../hooks/useCouponForm';

interface CouponFormModalProps {
  editingCoupon: Coupon | null;
  formData: CouponFormData;
  formErrors: CouponFormErrors;
  saving: boolean;
  onUpdate: (updates: Partial<CouponFormData>) => void;
  onBlur: (field: keyof CouponFormErrors) => void;
  onGenerate: () => void;
  onSave: () => void;
  onClose: () => void;
}

function CouponFormModal({
  editingCoupon,
  formData,
  formErrors,
  saving,
  onUpdate,
  onBlur,
  onGenerate,
  onSave,
  onClose,
}: CouponFormModalProps): React.ReactElement {
  const inputClass = (field: keyof CouponFormErrors) =>
    `w-full px-3 py-2 border ${
      formErrors[field]
        ? 'border-red-500 dark:border-red-400'
        : 'border-gray-300 dark:border-gray-600'
    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
            </h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Code */}
            <div>
              <label htmlFor="coupon-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Coupon Code *
              </label>
              <div className="flex gap-2">
                <input
                  id="coupon-code"
                  type="text"
                  value={formData.code}
                  onChange={(e) => onUpdate({ code: e.target.value.toUpperCase() })}
                  onBlur={() => onBlur('code')}
                  placeholder="e.g., SUMMER20"
                  className={`flex-1 px-3 py-2 border ${formErrors.code ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono uppercase`}
                />
                <button
                  type="button"
                  onClick={onGenerate}
                  title="Generate random code"
                  aria-label="Generate random code"
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              </div>
              {formErrors.code && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.code}</p>}
            </div>

            {/* Type and Amount */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="discount-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Discount Type
                </label>
                <select
                  id="discount-type"
                  value={formData.discount_type}
                  onChange={(e) => onUpdate({ discount_type: e.target.value as CouponDiscountType })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="percent">Percentage discount</option>
                  <option value="fixed_cart">Fixed cart discount</option>
                  <option value="fixed_product">Fixed product discount</option>
                </select>
              </div>
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount *
                </label>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => onUpdate({ amount: e.target.value })}
                  onBlur={() => onBlur('amount')}
                  placeholder={formData.discount_type === 'percent' ? 'e.g., 20' : 'e.g., 10.00'}
                  className={inputClass('amount')}
                />
                {formErrors.amount && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.amount}</p>}
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Internal description for this coupon"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label htmlFor="date-expires" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expiry Date
              </label>
              <input
                id="date-expires"
                type="date"
                value={formData.date_expires}
                onChange={(e) => onUpdate({ date_expires: e.target.value })}
                onBlur={() => onBlur('date_expires')}
                className={inputClass('date_expires')}
              />
              {formErrors.date_expires && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.date_expires}</p>}
            </div>

            {/* Usage Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="usage-limit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Usage Limit (Total)
                </label>
                <input
                  id="usage-limit"
                  type="number"
                  value={formData.usage_limit}
                  onChange={(e) => onUpdate({ usage_limit: e.target.value })}
                  onBlur={() => onBlur('usage_limit')}
                  placeholder="Unlimited"
                  className={inputClass('usage_limit')}
                />
                {formErrors.usage_limit && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.usage_limit}</p>}
              </div>
              <div>
                <label htmlFor="usage-limit-per-user" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Usage Limit (Per User)
                </label>
                <input
                  id="usage-limit-per-user"
                  type="number"
                  value={formData.usage_limit_per_user}
                  onChange={(e) => onUpdate({ usage_limit_per_user: e.target.value })}
                  onBlur={() => onBlur('usage_limit_per_user')}
                  placeholder="Unlimited"
                  className={inputClass('usage_limit_per_user')}
                />
                {formErrors.usage_limit_per_user && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.usage_limit_per_user}</p>}
              </div>
            </div>

            {/* Min/Max Amount */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="minimum-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minimum Spend
                </label>
                <input
                  id="minimum-amount"
                  type="number"
                  step="0.01"
                  value={formData.minimum_amount}
                  onChange={(e) => onUpdate({ minimum_amount: e.target.value })}
                  onBlur={() => onBlur('minimum_amount')}
                  placeholder="No minimum"
                  className={inputClass('minimum_amount')}
                />
                {formErrors.minimum_amount && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.minimum_amount}</p>}
              </div>
              <div>
                <label htmlFor="maximum-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Maximum Spend
                </label>
                <input
                  id="maximum-amount"
                  type="number"
                  step="0.01"
                  value={formData.maximum_amount}
                  onChange={(e) => onUpdate({ maximum_amount: e.target.value })}
                  onBlur={() => onBlur('maximum_amount')}
                  placeholder="No maximum"
                  className={inputClass('maximum_amount')}
                />
                {formErrors.maximum_amount && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{formErrors.maximum_amount}</p>}
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              {[
                { field: 'individual_use' as const, label: 'Individual use only (cannot be combined with other coupons)' },
                { field: 'free_shipping' as const, label: 'Allow free shipping' },
                { field: 'exclude_sale_items' as const, label: 'Exclude sale items' },
              ].map(({ field, label }) => (
                <label key={field} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData[field] as boolean}
                    onChange={(e) => onUpdate({ [field]: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onSave}
              disabled={saving || Object.keys(formErrors).length > 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(CouponFormModal);
