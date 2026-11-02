import { vi, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCouponForm, validateCouponForm, DEFAULT_COUPON_FORM } from '../useCouponForm';
import type { CouponFormData } from '../useCouponForm';
import { createMockStore } from '../../__test_utils__/mockFactories';
import WooCommerceService from '../../services/woocommerce';
import useOnlineStatus from '../useOnlineStatus';
import useOffline from '../../stores/offlineStore';
import { useToast } from '../useToast';
import type { Coupon } from '../../types';

vi.mock('../../services/woocommerce');
vi.mock('../useOnlineStatus');
vi.mock('../../stores/offlineStore');
vi.mock('../useToast');

const mockCreateCoupon = vi.fn();
const mockUpdateCoupon = vi.fn();
const mockAddPending = vi.fn();
const mockOfflineToast = vi.fn();
const onSuccess = vi.fn();
const onClose = vi.fn();
const logActivity = vi.fn();
const showToast = vi.fn();
const toast = { showToast } as unknown as Parameters<typeof useCouponForm>[0]['toast'];

const valid = (over: Partial<CouponFormData> = {}): CouponFormData => ({
  ...DEFAULT_COUPON_FORM,
  code: 'SAVE10',
  amount: '10',
  ...over,
});

const makeCoupon = (over: Record<string, unknown> = {}): Coupon =>
  ({
    id: 5,
    code: 'OLD-5',
    discount_type: 'fixed_cart',
    amount: '5.00',
    description: 'desc',
    date_expires: '2099-01-02T00:00:00',
    individual_use: true,
    usage_limit: 100,
    usage_limit_per_user: null,
    free_shipping: true,
    minimum_amount: '20',
    maximum_amount: '',
    exclude_sale_items: true,
    ...over,
  }) as unknown as Coupon;

let store: ReturnType<typeof createMockStore> | undefined;
let online = true;

function setup(coupons: Coupon[] = []) {
  return renderHook(() =>
    useCouponForm({ currentStore: store, coupons, onSuccess, onClose, toast, logActivity })
  );
}

beforeEach(() => {
  store = createMockStore();
  online = true;
  (useOnlineStatus as unknown as Mock).mockImplementation(() => ({ isOnline: online }));
  (useOffline as unknown as Mock).mockImplementation((sel: (s: unknown) => unknown) =>
    sel({ addPendingOperation: mockAddPending })
  );
  (useToast as unknown as Mock).mockReturnValue({ showToast: mockOfflineToast });
  (WooCommerceService as Mock).mockImplementation(function () {
    return { createCoupon: mockCreateCoupon, updateCoupon: mockUpdateCoupon };
  });
  onSuccess.mockResolvedValue(undefined);
});

describe('validateCouponForm', () => {
  it('accepts a valid form', () => {
    expect(validateCouponForm(valid())).toEqual({});
  });

  it.each([
    ['', 'Coupon code is required'],
    ['   ', 'Coupon code is required'],
    ['AB', 'Coupon code must be at least 3 characters'],
    ['AB CD', 'Coupon code can only contain letters, numbers, and hyphens'],
    ['AB_C', 'Coupon code can only contain letters, numbers, and hyphens'],
  ])('rejects code %j', (code, msg) => {
    expect(validateCouponForm(valid({ code })).code).toBe(msg);
  });

  it('accepts hyphens and digits in code', () => {
    expect(validateCouponForm(valid({ code: 'A-1-B' })).code).toBeUndefined();
  });

  it.each([
    ['', 'Discount amount is required'],
    ['abc', 'Discount amount must be a positive number'],
    ['0', 'Discount amount must be a positive number'],
    ['-3', 'Discount amount must be a positive number'],
  ])('rejects amount %j', (amount, msg) => {
    expect(validateCouponForm(valid({ amount })).amount).toBe(msg);
  });

  it('enforces 1-100 for percent but not for fixed', () => {
    expect(validateCouponForm(valid({ amount: '0.5' })).amount).toMatch(/between 1 and 100/);
    expect(validateCouponForm(valid({ amount: '101' })).amount).toMatch(/between 1 and 100/);
    expect(validateCouponForm(valid({ amount: '100' })).amount).toBeUndefined();
    expect(validateCouponForm(valid({ discount_type: 'fixed_cart', amount: '500' }))).toEqual({});
  });

  it('rejects past expiry, accepts future', () => {
    expect(validateCouponForm(valid({ date_expires: '2000-01-01' })).date_expires).toBe(
      'Expiry date must be in the future'
    );
    expect(validateCouponForm(valid({ date_expires: '2999-01-01' })).date_expires).toBeUndefined();
  });

  it('validates usage limits', () => {
    expect(validateCouponForm(valid({ usage_limit: '0' })).usage_limit).toBeDefined();
    expect(validateCouponForm(valid({ usage_limit: 'x' })).usage_limit).toBeDefined();
    expect(validateCouponForm(valid({ usage_limit: '5' })).usage_limit).toBeUndefined();
    expect(validateCouponForm(valid({ usage_limit_per_user: '-1' })).usage_limit_per_user).toBeDefined();
    expect(validateCouponForm(valid({ usage_limit_per_user: '2' })).usage_limit_per_user).toBeUndefined();
  });

  it('validates min/max spend', () => {
    expect(validateCouponForm(valid({ minimum_amount: '-1' })).minimum_amount).toBeDefined();
    expect(validateCouponForm(valid({ minimum_amount: '0' })).minimum_amount).toBeUndefined();
    expect(validateCouponForm(valid({ maximum_amount: '0' })).maximum_amount).toMatch(/positive/);
    expect(
      validateCouponForm(valid({ minimum_amount: '50', maximum_amount: '50' })).maximum_amount
    ).toMatch(/greater than minimum/);
    expect(validateCouponForm(valid({ minimum_amount: '10', maximum_amount: '50' }))).toEqual({});
    expect(validateCouponForm(valid({ maximum_amount: '5' }))).toEqual({});
  });
});

describe('useCouponForm', () => {
  it('starts with defaults', () => {
    const { result } = setup();
    expect(result.current.formData).toEqual(DEFAULT_COUPON_FORM);
    expect(result.current.editingCoupon).toBeNull();
    expect(result.current.saving).toBe(false);
  });

  it('initForEdit maps coupon to form data and strips time from expiry', () => {
    const { result } = setup();
    const c = makeCoupon();
    act(() => result.current.initForEdit(c));
    expect(result.current.editingCoupon).toBe(c);
    expect(result.current.formData).toMatchObject({
      code: 'OLD-5',
      discount_type: 'fixed_cart',
      amount: '5.00',
      date_expires: '2099-01-02',
      usage_limit: '100',
      usage_limit_per_user: '',
      minimum_amount: '20',
      maximum_amount: '',
      individual_use: true,
      free_shipping: true,
      exclude_sale_items: true,
    });
  });

  it('initForEdit handles null expiry and missing description', () => {
    const { result } = setup();
    act(() => result.current.initForEdit(makeCoupon({ date_expires: null, description: undefined })));
    expect(result.current.formData.date_expires).toBe('');
    expect(result.current.formData.description).toBe('');
  });

  it('initForCreate clears edit state', () => {
    const { result } = setup();
    act(() => result.current.initForEdit(makeCoupon()));
    act(() => result.current.initForCreate());
    expect(result.current.editingCoupon).toBeNull();
    expect(result.current.formData).toEqual(DEFAULT_COUPON_FORM);
  });

  it('only shows errors for touched fields', () => {
    const { result } = setup();
    act(() => result.current.updateFormData({ amount: '-1' }));
    expect(result.current.formErrors).toEqual({});
    act(() => result.current.handleFieldBlur('amount'));
    expect(result.current.formErrors.amount).toBeDefined();
    act(() => result.current.updateFormData({ amount: '10' }));
    expect(result.current.formErrors.amount).toBeUndefined();
    act(() => result.current.updateFormData({ amount: 'x' }));
    expect(result.current.formErrors.amount).toBeDefined();
    expect(result.current.formErrors.code).toBeUndefined();
  });

  it('generateCouponCode makes an 8-char uppercase alphanumeric code', () => {
    const { result } = setup();
    act(() => result.current.generateCouponCode());
    expect(result.current.formData.code).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('save is a no-op without a store', async () => {
    store = undefined;
    const { result } = setup();
    await act(() => result.current.handleSaveCoupon());
    expect(mockCreateCoupon).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('save blocks on validation errors and flags all fields', async () => {
    const { result } = setup();
    await act(() => result.current.handleSaveCoupon());
    expect(showToast).toHaveBeenCalledWith('Please fix the validation errors before saving', 'error');
    expect(result.current.formErrors.code).toBeDefined();
    expect(result.current.formErrors.amount).toBeDefined();
    expect(mockCreateCoupon).not.toHaveBeenCalled();
  });

  it('creates a coupon with mapped payload, prepends to list, logs and closes', async () => {
    const existing = makeCoupon({ id: 1 });
    const created = makeCoupon({ id: 99, code: 'NEW-10' });
    mockCreateCoupon.mockResolvedValue({ success: true, data: created });
    const { result } = setup([existing]);
    act(() =>
      result.current.updateFormData({
        code: 'SAVE10',
        amount: '15',
        date_expires: '2999-05-06',
        usage_limit: '50',
        usage_limit_per_user: '2',
        minimum_amount: '10',
        maximum_amount: '100',
        free_shipping: true,
      })
    );
    await act(() => result.current.handleSaveCoupon());

    expect(mockCreateCoupon).toHaveBeenCalledWith({
      code: 'SAVE10',
      discount_type: 'percent',
      amount: '15',
      description: '',
      date_expires: '2999-05-06T23:59:59',
      individual_use: false,
      usage_limit: 50,
      usage_limit_per_user: 2,
      free_shipping: true,
      minimum_amount: '10',
      maximum_amount: '100',
      exclude_sale_items: false,
    });
    expect(onSuccess).toHaveBeenCalledWith([created, existing], created, false);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'coupon_created', entityId: 99, entityName: 'NEW-10' })
    );
    expect(showToast).toHaveBeenCalledWith('Coupon created successfully', 'success');
    expect(onClose).toHaveBeenCalled();
    expect(result.current.formData).toEqual(DEFAULT_COUPON_FORM);
    expect(result.current.saving).toBe(false);
  });

  it('sends null for empty optional fields', async () => {
    mockCreateCoupon.mockResolvedValue({ success: true, data: makeCoupon() });
    const { result } = setup();
    act(() => result.current.updateFormData({ code: 'ABC', amount: '5' }));
    await act(() => result.current.handleSaveCoupon());
    expect(mockCreateCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ date_expires: null, usage_limit: null, usage_limit_per_user: null })
    );
  });

  it('updates an existing coupon in place', async () => {
    const a = makeCoupon({ id: 1, code: 'A-1' });
    const b = makeCoupon({ id: 5 });
    const updated = makeCoupon({ id: 5, code: 'UPD-5' });
    mockUpdateCoupon.mockResolvedValue({ success: true, data: updated });
    const { result } = setup([a, b]);
    act(() => result.current.initForEdit(b));
    await act(() => result.current.handleSaveCoupon());
    expect(mockUpdateCoupon).toHaveBeenCalledWith(5, expect.objectContaining({ code: 'OLD-5' }));
    expect(mockCreateCoupon).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith([a, updated], updated, true);
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'coupon_updated' }));
    expect(showToast).toHaveBeenCalledWith('Coupon updated successfully', 'success');
  });

  it('shows an error toast and keeps the form open when the API fails', async () => {
    mockCreateCoupon.mockResolvedValue({ success: false, error: 'Code exists' });
    const { result } = setup();
    act(() => result.current.updateFormData({ code: 'DUP', amount: '5' }));
    await act(() => result.current.handleSaveCoupon());
    expect(showToast).toHaveBeenCalledWith('Failed to save coupon: Code exists', 'error');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.formData.code).toBe('DUP');
    expect(result.current.saving).toBe(false);
  });

  it('queues the mutation when offline instead of calling the API', async () => {
    online = false;
    const { result } = setup();
    act(() => result.current.updateFormData({ code: 'OFF', amount: '5' }));
    await act(() => result.current.handleSaveCoupon());
    expect(mockCreateCoupon).not.toHaveBeenCalled();
    expect(mockAddPending).toHaveBeenCalledWith(
      'create_coupon',
      expect.objectContaining({ code: 'OFF', amount: '5' }),
      store!.id
    );
    expect(mockOfflineToast).toHaveBeenCalledWith(expect.stringMatching(/offline/i), 'warning');
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.saving).toBe(false);
  });

  it('queues edits with the coupon id when offline', async () => {
    online = false;
    const { result } = setup();
    act(() => result.current.initForEdit(makeCoupon()));
    await act(() => result.current.handleSaveCoupon());
    expect(mockAddPending).toHaveBeenCalledWith(
      'update_coupon',
      expect.objectContaining({ id: 5, code: 'OLD-5' }),
      store!.id
    );
  });
});

// Documents current behaviour (possible bug): handleSaveCoupon uppercases the code, but validation
// runs first and rejects lowercase letters, so the uppercase step is unreachable for typed input.
describe('lowercase code', () => {
  it('is rejected by validation', () => {
    expect(validateCouponForm(valid({ code: 'summer' })).code).toBeDefined();
  });
});
