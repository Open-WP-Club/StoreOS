import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaxRatesTab from '../TaxRatesTab';
import type { TaxRateFormData } from '../../pages/TaxPage';

const form: TaxRateFormData = {
  country: '', state: '', postcode: '', city: '', rate: '', name: '',
  priority: 12, compound: false, shipping: true, class: '',
};

function setup(priority: number | '') {
  const onRateFormChange = vi.fn();
  render(
    <TaxRatesTab
      taxRates={[]} filteredRates={[]} taxClasses={[]} filterClass="all"
      onFilterClassChange={vi.fn()} loadData={vi.fn()} loading={false} saving={false}
      showRateForm editingRateId={null} rateForm={{ ...form, priority }}
      onRateFormChange={onRateFormChange} onCreateRate={vi.fn()} onSaveRate={vi.fn()}
      onCancelRateForm={vi.fn()} onEditRate={vi.fn()} onDeleteRate={vi.fn()}
    />
  );
  return onRateFormChange;
}

describe('TaxRatesTab priority input', () => {
  it('allows clearing without snapping to 1', () => {
    const onChange = setup(12);
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ priority: '' }));
  });

  it('defaults empty priority to 1 on blur', () => {
    const onChange = setup('');
    fireEvent.blur(screen.getByLabelText('Priority'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ priority: 1 }));
  });
});
