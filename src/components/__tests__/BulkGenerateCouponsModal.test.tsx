import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulkGenerateCouponsModal from '../BulkGenerateCouponsModal';
import { batchErrorIds } from '../../utils/batchResult';
import type WooCommerceService from '../../services/woocommerce';

const batchCreateCoupons = vi.fn();
const onClose = vi.fn();
const onGenerated = vi.fn();

const okCreate = (n: number) => ({
  success: true,
  data: { create: Array.from({ length: n }, (_, i) => ({ id: i + 1, code: `C${i}` })) },
});

function renderModal() {
  const service = { batchCreateCoupons } as unknown as WooCommerceService;
  return render(
    <BulkGenerateCouponsModal service={service} onClose={onClose} onGenerated={onGenerated} />
  );
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const generateBtn = () =>
  screen.getByRole('button', { name: /^generate \d+ coupons$|generating/i });

beforeEach(() => {
  batchCreateCoupons.mockResolvedValue(okCreate(10));
});

describe('BulkGenerateCouponsModal', () => {
  it('renders defaults', () => {
    renderModal();
    expect(screen.getByText('Bulk Generate Coupons')).toBeInTheDocument();
    expect(screen.getByLabelText(/number of coupons/i)).toHaveValue(10);
    expect(generateBtn()).toHaveTextContent('Generate 10 Coupons');
  });

  it.each([
    ['500', 100],
    ['0', 1],
    ['-4', 1],
    ['', 1],
  ])('clamps count input %j to %i', (raw, expected) => {
    renderModal();
    type(/number of coupons/i, raw);
    fireEvent.blur(screen.getByLabelText(/number of coupons/i));
    // '' and '0' leave the previous value / 1; assert the button reflects the clamped count
    expect(generateBtn()).toHaveTextContent(`Generate ${expected} Coupons`);
  });

  it('shows the prefix preview uppercased', () => {
    renderModal();
    type(/code prefix/i, 'summer');
    expect(screen.getByLabelText(/code prefix/i)).toHaveValue('SUMMER');
    expect(screen.getByText(/SUMMER-XXXXXX/)).toBeInTheDocument();
  });

  it('blocks generation with a missing amount and shows the error', async () => {
    renderModal();
    await userEvent.click(generateBtn());
    expect(screen.getByText('Discount amount is required')).toBeInTheDocument();
    expect(batchCreateCoupons).not.toHaveBeenCalled();
    expect(generateBtn()).toBeDisabled();
  });

  it('shows field errors only after blur, then clears them when fixed', () => {
    renderModal();
    type(/^amount/i, '150');
    expect(screen.queryByText(/between 1 and 100/)).not.toBeInTheDocument();
    fireEvent.blur(screen.getByLabelText(/^amount/i));
    expect(screen.getByText(/between 1 and 100/)).toBeInTheDocument();
    type(/^amount/i, '50');
    expect(screen.queryByText(/between 1 and 100/)).not.toBeInTheDocument();
  });

  it('fixed discount types allow amounts over 100', async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/discount type/i), { target: { value: 'fixed_cart' } });
    type(/^amount/i, '250');
    await userEvent.click(generateBtn());
    await waitFor(() => expect(batchCreateCoupons).toHaveBeenCalled());
  });

  it.each([
    [/usage limit \(total\)/i, '0', /usage limit must be/i],
    [/per user/i, '0', /per user must be/i],
    [/minimum spend/i, '-5', /minimum spend must be/i],
    [/maximum spend/i, '0', /maximum spend must be a positive/i],
    [/expiry date/i, '2000-01-01', /must be in the future/i],
  ])('validates %s on blur', (label, value, msg) => {
    renderModal();
    type(label, value);
    fireEvent.blur(screen.getByLabelText(label));
    expect(screen.getByText(msg)).toBeInTheDocument();
  });

  it('requires maximum spend to exceed minimum spend', () => {
    renderModal();
    type(/minimum spend/i, '20');
    type(/maximum spend/i, '10');
    fireEvent.blur(screen.getByLabelText(/maximum spend/i));
    expect(screen.getByText(/greater than minimum/i)).toBeInTheDocument();
  });

  it('maps every field to the batch payload and generates unique prefixed codes', async () => {
    batchCreateCoupons.mockResolvedValue(okCreate(25));
    renderModal();
    type(/number of coupons/i, '25');
    type(/code prefix/i, 'vip');
    type(/^amount/i, '20');
    type(/description/i, 'Launch');
    type(/expiry date/i, '2999-12-31');
    type(/usage limit \(total\)/i, '3');
    type(/per user/i, '1');
    type(/minimum spend/i, '10');
    type(/maximum spend/i, '99.5');
    await userEvent.click(screen.getByLabelText(/individual use/i));
    await userEvent.click(screen.getByLabelText(/free shipping/i));
    await userEvent.click(screen.getByLabelText(/exclude sale/i));
    await userEvent.click(generateBtn());

    await waitFor(() => expect(batchCreateCoupons).toHaveBeenCalledTimes(1));
    const batch = batchCreateCoupons.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(batch).toHaveLength(25);
    const codes = batch.map((c) => c.code as string);
    expect(new Set(codes).size).toBe(25);
    codes.forEach((c) => expect(c).toMatch(/^VIP-[A-HJ-NP-Z2-9]{6}$/));
    expect(batch[0]).toMatchObject({
      discount_type: 'percent',
      amount: '20',
      description: 'Launch',
      date_expires: '2999-12-31T23:59:59',
      individual_use: true,
      usage_limit: 3,
      usage_limit_per_user: 1,
      free_shipping: true,
      minimum_amount: '10',
      maximum_amount: '99.5',
      exclude_sale_items: true,
    });
  });

  it('uses unprefixed codes and nulls for empty optional fields', async () => {
    renderModal();
    type(/^amount/i, '5');
    await userEvent.click(generateBtn());
    await waitFor(() => expect(batchCreateCoupons).toHaveBeenCalled());
    const batch = batchCreateCoupons.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(batch[0]).toMatchObject({
      date_expires: null,
      usage_limit: null,
      usage_limit_per_user: null,
    });
    expect(batch[0]!.code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it('reports success, calls onGenerated and then closes via the result screen', async () => {
    renderModal();
    type(/^amount/i, '5');
    await userEvent.click(generateBtn());
    expect(await screen.findByText('Generation Complete')).toBeInTheDocument();
    expect(screen.getByText(/successfully created/i)).toHaveTextContent('10');
    expect(screen.queryByText(/^failed/i)).not.toBeInTheDocument();
    expect(onGenerated).toHaveBeenCalledWith(okCreate(10).data.create);
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    await userEvent.click(closeButtons[closeButtons.length - 1]!);
    expect(onClose).toHaveBeenCalled();
  });

  it('counts the whole batch as failed when the API call fails, without onGenerated', async () => {
    batchCreateCoupons.mockResolvedValue({ success: false, error: 'nope' });
    renderModal();
    type(/^amount/i, '5');
    await userEvent.click(generateBtn());
    expect(await screen.findByText('Generation Complete')).toBeInTheDocument();
    expect(screen.getByText(/failed:/i)).toHaveTextContent('10');
    expect(screen.getByText(/successfully created/i)).toHaveTextContent('0');
    expect(onGenerated).not.toHaveBeenCalled();
  });

  it('treats a success response without a create array as a failed batch', async () => {
    batchCreateCoupons.mockResolvedValue({ success: true, data: {} });
    renderModal();
    type(/^amount/i, '5');
    await userEvent.click(generateBtn());
    expect(await screen.findByText(/failed:/i)).toHaveTextContent('10');
  });

  it('shows progress and disables the controls while generating', async () => {
    let release: (v: unknown) => void = () => {};
    batchCreateCoupons.mockReturnValue(new Promise((r) => (release = r)));
    renderModal();
    type(/^amount/i, '5');
    await userEvent.click(generateBtn());
    expect(await screen.findByText('Generating coupons...')).toBeInTheDocument();
    expect(screen.getByLabelText('Close')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(generateBtn()).toBeDisabled();
    release(okCreate(10));
    expect(await screen.findByText('Generation Complete')).toBeInTheDocument();
  });

  it('Cancel and the X close the modal when idle', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  // BUG (documented, not fixed): WooCommerce batch responses return HTTP 200 with per-item
  // `error` entries inside `create`. The modal counts every entry as a success and passes the
  // error stubs to onGenerated, instead of using batchErrorIds like other batch call sites.
  it('per-item errors in a 200 batch response are counted as failures', async () => {
    const data = {
      create: [
        { id: 1, code: 'OK-1' },
        { id: 0, error: { code: 'woocommerce_coupon_code_already_exists' } },
      ],
    };
    expect(batchErrorIds(data as never, 'create')).toEqual([0]);
    batchCreateCoupons.mockResolvedValue({ success: true, data });
    renderModal();
    type(/^amount/i, '5');
    await userEvent.click(generateBtn());
    expect(await screen.findByText(/successfully created/i)).toHaveTextContent('1');
    expect(screen.getByText(/failed:/i)).toHaveTextContent('1');
    expect(onGenerated).toHaveBeenCalledWith([data.create[0]]);
  });
});
