import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsNotifications from '../SettingsNotifications';

type Props = React.ComponentProps<typeof SettingsNotifications>;

const make = (over: Partial<Props> = {}): Props => ({
  language: 'en',
  notifyNewOrders: false,
  setNotifyNewOrders: vi.fn(),
  notifyLowStock: false,
  setNotifyLowStock: vi.fn(),
  lowStockThreshold: 5,
  setLowStockThreshold: vi.fn(),
  orderSplitDays: 7,
  setOrderSplitDays: vi.fn(),
  soundEnabled: false,
  setSoundEnabled: vi.fn(),
  confettiEnabled: false,
  setConfettiEnabled: vi.fn(),
  notifications: [],
  clearNotifications: vi.fn(),
  onClearNotifications: vi.fn(),
  ...over,
});

describe('SettingsNotifications', () => {
  it('toggles each switch with the inverted value and flips its aria-label', () => {
    const p = make({ notifyLowStock: true });
    render(<SettingsNotifications {...p} />);
    fireEvent.click(screen.getByLabelText('Enable new order notifications'));
    fireEvent.click(screen.getByLabelText('Disable low stock notifications'));
    fireEvent.click(screen.getByLabelText('Enable notification sound'));
    fireEvent.click(screen.getByLabelText('Enable order celebration'));
    expect(p.setNotifyNewOrders).toHaveBeenCalledWith(true);
    expect(p.setNotifyLowStock).toHaveBeenCalledWith(false);
    expect(p.setSoundEnabled).toHaveBeenCalledWith(true);
    expect(p.setConfettiEnabled).toHaveBeenCalledWith(true);
  });

  it('threshold inputs parse numbers and fall back to defaults on empty', () => {
    const p = make();
    render(<SettingsNotifications {...p} />);
    const [low, days] = screen.getAllByRole('spinbutton');
    fireEvent.change(low!, { target: { value: '12' } });
    fireEvent.change(days!, { target: { value: '30' } });
    expect(p.setLowStockThreshold).toHaveBeenCalledWith(12);
    expect(p.setOrderSplitDays).toHaveBeenCalledWith(30);
    fireEvent.change(low!, { target: { value: '' } });
    fireEvent.change(days!, { target: { value: '' } });
    fireEvent.blur(low!);
    fireEvent.blur(days!);
    expect(p.setLowStockThreshold).toHaveBeenLastCalledWith(5);
    expect(p.setOrderSplitDays).toHaveBeenLastCalledWith(7);
  });

  it('shows history clear only when there are notifications', () => {
    const p = make({ notifications: [{}, {}] });
    const { rerender } = render(<SettingsNotifications {...p} />);
    expect(screen.getByText('2 notifications')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Clear'));
    expect(p.onClearNotifications).toHaveBeenCalled();
    rerender(<SettingsNotifications {...make()} />);
    expect(screen.queryByText('Clear')).toBeNull();
  });

  it('renders Bulgarian copy', () => {
    render(<SettingsNotifications {...make({ language: 'bg' })} />);
    expect(screen.getByText('Известия')).toBeInTheDocument();
    expect(screen.getByText('Нисък запас')).toBeInTheDocument();
  });
});
