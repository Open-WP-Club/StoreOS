import { useState, useCallback } from 'react';
import WooCommerceService from '../services/woocommerce';
import { useOfflineMutation } from './useOfflineMutation';
import type { Coupon, CouponDiscountType, CouponUpdateData, WooCommerceStore } from '../types';
import type { UseToastReturn } from './useToast';

// ============================================
// Types
// ============================================

export interface CouponFormData {
  code: string;
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

export interface CouponFormErrors {
  code?: string;
  amount?: string;
  date_expires?: string;
  usage_limit?: string;
  usage_limit_per_user?: string;
  minimum_amount?: string;
  maximum_amount?: string;
}

// ============================================
// Validation
// ============================================

export function validateCouponForm(data: CouponFormData): CouponFormErrors {
  const errors: CouponFormErrors = {};

  if (!data.code.trim()) {
    errors.code = 'Coupon code is required';
  } else if (data.code.trim().length < 3) {
    errors.code = 'Coupon code must be at least 3 characters';
  } else if (!/^[A-Z0-9-]+$/.test(data.code.trim())) {
    errors.code = 'Coupon code can only contain letters, numbers, and hyphens';
  }

  if (!data.amount) {
    errors.amount = 'Discount amount is required';
  } else {
    const amt = parseFloat(data.amount);
    if (isNaN(amt) || amt <= 0) {
      errors.amount = 'Discount amount must be a positive number';
    } else if (data.discount_type === 'percent' && (amt < 1 || amt > 100)) {
      errors.amount = 'Percentage discount must be between 1 and 100';
    }
  }

  if (data.date_expires) {
    const expiry = new Date(data.date_expires);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expiry < today) errors.date_expires = 'Expiry date must be in the future';
  }

  if (data.usage_limit) {
    const limit = parseInt(data.usage_limit);
    if (isNaN(limit) || limit < 1 || !Number.isInteger(limit))
      errors.usage_limit = 'Usage limit must be a positive whole number';
  }

  if (data.usage_limit_per_user) {
    const limit = parseInt(data.usage_limit_per_user);
    if (isNaN(limit) || limit < 1 || !Number.isInteger(limit))
      errors.usage_limit_per_user = 'Usage limit per user must be a positive whole number';
  }

  if (data.minimum_amount) {
    const min = parseFloat(data.minimum_amount);
    if (isNaN(min) || min < 0) errors.minimum_amount = 'Minimum spend must be a positive number';
  }

  if (data.maximum_amount) {
    const max = parseFloat(data.maximum_amount);
    if (isNaN(max) || max <= 0) {
      errors.maximum_amount = 'Maximum spend must be a positive number';
    } else if (data.minimum_amount) {
      const min = parseFloat(data.minimum_amount);
      if (!isNaN(min) && max <= min)
        errors.maximum_amount = 'Maximum spend must be greater than minimum spend';
    }
  }

  return errors;
}

// ============================================
// Default State
// ============================================

export const DEFAULT_COUPON_FORM: CouponFormData = {
  code: '',
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

// ============================================
// Hook
// ============================================

interface UseCouponFormOptions {
  currentStore: WooCommerceStore | undefined;
  coupons: Coupon[];
  onSuccess: (updatedCoupons: Coupon[], coupon: Coupon, isEdit: boolean) => Promise<void>;
  onClose: () => void;
  toast: UseToastReturn;
  logActivity: (entry: {
    action: 'coupon_created' | 'coupon_updated';
    entityType: 'coupon';
    entityId: number;
    entityName: string;
    storeId: string | null;
    storeName?: string;
  }) => void;
}

export interface UseCouponFormReturn {
  formData: CouponFormData;
  formErrors: CouponFormErrors;
  saving: boolean;
  editingCoupon: Coupon | null;
  updateFormData: (updates: Partial<CouponFormData>) => void;
  handleFieldBlur: (field: keyof CouponFormErrors) => void;
  generateCouponCode: () => void;
  handleSaveCoupon: () => Promise<void>;
  initForCreate: () => void;
  initForEdit: (coupon: Coupon) => void;
  reset: () => void;
}

export function useCouponForm({
  currentStore,
  coupons,
  onSuccess,
  onClose,
  toast,
  logActivity,
}: UseCouponFormOptions): UseCouponFormReturn {
  const [formData, setFormData] = useState<CouponFormData>(DEFAULT_COUPON_FORM);
  const [formErrors, setFormErrors] = useState<CouponFormErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const { mutate: offlineMutate } = useOfflineMutation();

  const reset = useCallback(() => {
    setFormData(DEFAULT_COUPON_FORM);
    setFormErrors({});
    setTouchedFields(new Set());
    setEditingCoupon(null);
  }, []);

  const initForCreate = useCallback(() => {
    reset();
  }, [reset]);

  const initForEdit = useCallback((coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormErrors({});
    setTouchedFields(new Set());
    setFormData({
      code: coupon.code,
      discount_type: coupon.discount_type,
      amount: coupon.amount,
      description: coupon.description || '',
      date_expires: coupon.date_expires ? (coupon.date_expires.split('T')[0] ?? '') : '',
      individual_use: coupon.individual_use,
      usage_limit: coupon.usage_limit?.toString() || '',
      usage_limit_per_user: coupon.usage_limit_per_user?.toString() || '',
      free_shipping: coupon.free_shipping,
      minimum_amount: coupon.minimum_amount || '',
      maximum_amount: coupon.maximum_amount || '',
      exclude_sale_items: coupon.exclude_sale_items,
    });
  }, []);

  const updateFormData = useCallback(
    (updates: Partial<CouponFormData>): void => {
      setFormData((prev) => {
        const next = { ...prev, ...updates };
        setFormErrors(() => {
          const newErrors = validateCouponForm(next);
          const filtered: CouponFormErrors = {};
          (Object.keys(newErrors) as (keyof CouponFormErrors)[]).forEach((key) => {
            if (touchedFields.has(key)) filtered[key] = newErrors[key];
          });
          return filtered;
        });
        return next;
      });
    },
    [touchedFields]
  );

  const handleFieldBlur = useCallback((field: keyof CouponFormErrors): void => {
    setTouchedFields((prev) => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
    setFormData((current) => {
      const errors = validateCouponForm(current);
      setFormErrors((prev) => {
        const updated = { ...prev };
        if (errors[field]) {
          updated[field] = errors[field];
        } else {
          delete updated[field];
        }
        return updated;
      });
      return current;
    });
  }, []);

  const generateCouponCode = useCallback((): void => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormData((prev) => ({ ...prev, code }));
  }, []);

  const handleSaveCoupon = useCallback(async (): Promise<void> => {
    if (!currentStore) return;

    const allFields: (keyof CouponFormErrors)[] = [
      'code', 'amount', 'date_expires', 'usage_limit',
      'usage_limit_per_user', 'minimum_amount', 'maximum_amount',
    ];
    setTouchedFields(new Set(allFields));
    const errors = validateCouponForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.showToast('Please fix the validation errors before saving', 'error');
      return;
    }

    const isEdit = !!editingCoupon;
    const couponData: CouponUpdateData = {
      code: formData.code.toUpperCase().replace(/\s+/g, ''),
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

    setSaving(true);
    try {
      await offlineMutate({
        operationType: isEdit ? 'update_coupon' : 'create_coupon',
        queueData: isEdit
          ? { id: editingCoupon!.id, ...couponData as Record<string, unknown> }
          : couponData as Record<string, unknown>,
        storeId: currentStore.id,
        execute: async () => {
          const service = new WooCommerceService(currentStore);
          const result = isEdit
            ? await service.updateCoupon(editingCoupon!.id, couponData)
            : await service.createCoupon(couponData);
          if (!result.success) throw new Error(result.error);
          return result;
        },
        onSuccess: async (result) => {
          const updatedCoupons = isEdit
            ? coupons.map((c) => (c.id === editingCoupon!.id ? result.data : c))
            : [result.data, ...coupons];

          await onSuccess(updatedCoupons, result.data, isEdit);
          logActivity({
            action: isEdit ? 'coupon_updated' : 'coupon_created',
            entityType: 'coupon',
            entityId: result.data.id,
            entityName: result.data.code,
            storeId: currentStore.id ?? null,
            storeName: currentStore.name,
          });
          toast.showToast(
            isEdit ? 'Coupon updated successfully' : 'Coupon created successfully',
            'success'
          );
          reset();
          onClose();
        },
        onError: (error) => toast.showToast(`Failed to save coupon: ${error}`, 'error'),
      });
    } finally {
      setSaving(false);
    }
  }, [currentStore, formData, editingCoupon, coupons, onSuccess, onClose, toast, logActivity, reset, offlineMutate]);

  return {
    formData,
    formErrors,
    saving,
    editingCoupon,
    updateFormData,
    handleFieldBlur,
    generateCouponCode,
    handleSaveCoupon,
    initForCreate,
    initForEdit,
    reset,
  };
}
