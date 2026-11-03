import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SettingsUpdates from '../SettingsUpdates';
import type { UpdateState } from '../../../types/electron';

const setup = (initial: UpdateState) => {
  let push: (s: UpdateState) => void = () => {};
  const updater = {
    getState: vi.fn().mockResolvedValue(initial),
    check: vi.fn(),
    download: vi.fn(),
    install: vi.fn(),
    onStatus: vi.fn((cb: (s: UpdateState) => void) => {
      push = cb;
      return () => {};
    }),
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = { updater };
  return { updater, push: (s: UpdateState) => act(() => push(s)) };
};

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
});

describe('SettingsUpdates', () => {
  it('checks, then offers download and restart only on user click', async () => {
    const { updater, push } = setup({ status: 'idle', currentVersion: '1.1.0' });
    render(<SettingsUpdates language="en" />);
    fireEvent.click(await screen.findByText('Check for updates'));
    expect(updater.check).toHaveBeenCalled();

    push({ status: 'available', currentVersion: '1.1.0', version: '1.2.0' });
    fireEvent.click(await screen.findByText('Download update'));
    expect(updater.download).toHaveBeenCalled();
    expect(updater.install).not.toHaveBeenCalled();

    push({ status: 'downloaded', currentVersion: '1.1.0', version: '1.2.0' });
    fireEvent.click(await screen.findByText('Restart to install'));
    expect(updater.install).toHaveBeenCalled();
  });

  it('shows errors and hides actions when disabled', async () => {
    const { push } = setup({ status: 'disabled', currentVersion: '1.1.0' });
    render(<SettingsUpdates language="en" />);
    await waitFor(() =>
      expect(screen.getByText(/only available in installed/)).toBeInTheDocument()
    );
    expect(screen.queryByText('Check for updates')).toBeNull();
    push({ status: 'error', currentVersion: '1.1.0', error: 'boom' });
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });
});
