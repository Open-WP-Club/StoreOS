import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PinLockScreen from '../PinLockScreen';
import useAppSettings from '../../stores/appSettingsStore';

const press = (digits: string): void => {
  for (const d of digits) fireEvent.click(screen.getByRole('button', { name: d }));
};

describe('PinLockScreen', () => {
  beforeEach(async () => {
    useAppSettings.setState({ pinEnabled: true, isLocked: true });
    await useAppSettings.getState().setPinCode('123456');
  });

  it('shows one dot per PIN digit', () => {
    const { container } = render(<PinLockScreen />);
    expect(container.querySelectorAll('.rounded-full.w-4')).toHaveLength(6);
  });

  it('does not submit before the full PIN length is entered', async () => {
    render(<PinLockScreen />);
    press('1234');
    await new Promise((r) => setTimeout(r, 200));
    expect(useAppSettings.getState().isLocked).toBe(true);
    expect(useAppSettings.getState().failedPinAttempts).toBe(0);
  });

  it('unlocks once all digits are entered', async () => {
    render(<PinLockScreen />);
    press('123456');
    await waitFor(() => expect(useAppSettings.getState().isLocked).toBe(false));
  });

  it('uses 4 dots for a 4-digit PIN', async () => {
    await useAppSettings.getState().setPinCode('1234');
    const { container } = render(<PinLockScreen />);
    expect(container.querySelectorAll('.rounded-full.w-4')).toHaveLength(4);
  });
});
