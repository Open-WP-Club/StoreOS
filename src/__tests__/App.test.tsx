import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Outlet, MemoryRouter } from 'react-router-dom';
import App from '../App';
import { useStoreConfig, useTheme, useAppSettings, useCache } from '../stores';
import { createMockStore } from '../__test_utils__';

const dataManagerMounts = vi.fn();
const route = vi.hoisted(() => ({ path: '/' }));

// The test setup replaces window.location with a static copy, so HashRouter cannot navigate in jsdom.
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return {
    ...actual,
    HashRouter: ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={[route.path]}>{children}</MemoryRouter>
    ),
  };
});

vi.mock('../components/Layout', () => ({
  default: () => (
    <div data-testid="layout">
      <Outlet />
    </div>
  ),
}));
vi.mock('../components/DataManager', async () => {
  const React = await import('react');
  return {
    default: () => {
      React.useEffect(() => {
        dataManagerMounts();
      }, []);
      return null;
    },
  };
});
vi.mock('../components/LoadingScreen', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>loading-screen</button>
  ),
}));
vi.mock('../components/PinLockScreen', async () => {
  const { default: store } = await import('../stores/appSettingsStore');
  return {
    default: () => (store((s) => s.isLocked) ? <div>pin-locked</div> : null),
  };
});
vi.mock('../components/OfflineIndicator', () => ({ default: () => null }));
vi.mock('../components/CommandPalette', () => ({ default: () => null }));
vi.mock('../components/OrderCelebrationOverlay', () => ({ default: () => null }));
vi.mock('../pages/Dashboard', () => ({ default: () => <div>dashboard-page</div> }));
vi.mock('../pages/OrdersPage', () => ({ default: () => <div>orders-page</div> }));
vi.mock('../pages/ProductsPage', () => ({ default: () => <div>products-page</div> }));
vi.mock('../pages/SetupPage', () => ({ default: () => <div>setup-page</div> }));
vi.mock('../utils/memoryMonitor', () => ({
  startMemoryMonitor: vi.fn(),
  stopMemoryMonitor: vi.fn(),
}));

describe('App', () => {
  beforeEach(() => {
    route.path = '/';
    document.documentElement.classList.remove('dark');
    useStoreConfig.setState({ stores: [] });
    useTheme.setState({ theme: 'light' });
    useAppSettings.setState({
      isInitialized: true,
      pinEnabled: false,
      pinCode: null,
      isLocked: false,
    });
  });

  it('shows the loading screen on first launch, then the app', async () => {
    useAppSettings.setState({ isInitialized: false });
    render(<App />);
    await act(async () => {
      screen.getByText('loading-screen').click();
    });
    expect(useAppSettings.getState().isInitialized).toBe(true);
    expect(await screen.findByText('setup-page')).toBeInTheDocument();
  });

  it('redirects to /setup when no store is configured and does not mount DataManager', async () => {
    route.path = '/orders';
    render(<App />);
    expect(await screen.findByText('setup-page')).toBeInTheDocument();
    expect(dataManagerMounts).not.toHaveBeenCalled();
  });

  it('renders routes inside the layout and mounts DataManager once when a store exists', async () => {
    useStoreConfig.setState({ stores: [createMockStore()] });
    route.path = '/orders';
    const { rerender } = render(<App />);
    expect(await screen.findByText('orders-page')).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
    rerender(<App />);
    expect(dataManagerMounts).toHaveBeenCalledTimes(1);
  });

  it('renders the dashboard on / and redirects unknown paths to /', async () => {
    useStoreConfig.setState({ stores: [createMockStore()] });
    route.path = '/does-not-exist';
    render(<App />);
    expect(await screen.findByText('dashboard-page')).toBeInTheDocument();
  });

  it('locks on launch when a PIN is enabled', async () => {
    useStoreConfig.setState({ stores: [createMockStore()] });
    useAppSettings.setState({ pinEnabled: true, pinCode: 'hash' });
    render(<App />);
    expect(await screen.findByText('pin-locked')).toBeInTheDocument();
  });

  it('does not lock without a PIN', async () => {
    useStoreConfig.setState({ stores: [createMockStore()] });
    render(<App />);
    await screen.findByText('dashboard-page');
    expect(screen.queryByText('pin-locked')).not.toBeInTheDocument();
  });

  it('applies the dark class based on theme', async () => {
    useTheme.setState({ theme: 'dark' });
    render(<App />);
    await screen.findByText('setup-page');
    expect(document.documentElement).toHaveClass('dark');
    act(() => useTheme.setState({ theme: 'light' }));
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('handles Electron clear-cache and notification-click events', async () => {
    useStoreConfig.setState({ stores: [createMockStore()] });
    let clearCb: () => void = () => {};
    let notifCb: (d: { route?: string }) => void = () => {};
    const unsub = vi.fn();
    window.electronAPI = {
      onClearCache: vi.fn((cb: () => void) => {
        clearCb = cb;
        return unsub;
      }),
      onNotificationClicked: vi.fn((cb: (d: { route?: string }) => void) => {
        notifCb = cb;
        return unsub;
      }),
    } as unknown as typeof window.electronAPI;
    try {
      const { unmount } = render(<App />);
      await screen.findByText('dashboard-page');

      act(() => notifCb({ route: '/orders' }));
      expect(await screen.findByText('orders-page')).toBeInTheDocument();

      const clearSpy = vi.fn();
      act(() => useCache.setState({ clearCache: clearSpy }));
      vi.useFakeTimers();
      act(() => clearCb());
      expect(clearSpy).toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(window.location.reload).toHaveBeenCalled();
      vi.useRealTimers();
      unmount();
      expect(unsub).toHaveBeenCalled();
    } finally {
      delete (window as { electronAPI?: unknown }).electronAPI;
    }
  });
});
