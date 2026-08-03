import { vi, Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import { useCacheFirstLoad } from '../useCacheFirstLoad';
import { useStoreConfig } from '../../stores';
import { createMockStore } from '../../__test_utils__';

vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}));

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('useCacheFirstLoad', () => {
  const mockStore = createMockStore();

  beforeEach(() => {
    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { getCurrentStore: () => mockStore };
      return selector ? selector(state) : state;
    });
  });

  it('should start with loading state', async () => {
    const { result } = renderHook(
      () =>
        useCacheFirstLoad({
          getFromCache: () => null,
          fetchFromApi: vi.fn().mockResolvedValue(null),
          onData: vi.fn(),
          id: '1',
        }),
      { wrapper }
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    // Wait for async effects to settle
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should load from cache first and set data immediately', async () => {
    const cachedData = { id: 1, name: 'Cached Item' };
    const onData = vi.fn();
    const fetchFromApi = vi.fn().mockResolvedValue(null);

    const { result } = renderHook(
      () =>
        useCacheFirstLoad({
          getFromCache: () => cachedData,
          fetchFromApi,
          onData,
          id: '1',
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(cachedData);
    expect(onData).toHaveBeenCalledWith(cachedData);
  });

  it('should fetch from API when cache is empty', async () => {
    const apiData = { id: 1, name: 'API Item' };
    const onData = vi.fn();
    const fetchFromApi = vi.fn().mockResolvedValue(apiData);

    const { result } = renderHook(
      () =>
        useCacheFirstLoad({
          getFromCache: () => null,
          fetchFromApi,
          onData,
          id: '1',
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(apiData);
    expect(onData).toHaveBeenCalledWith(apiData);
  });

  it('should set error when fetch fails and no cached data', async () => {
    const fetchFromApi = vi.fn().mockResolvedValue(null);

    const { result } = renderHook(
      () =>
        useCacheFirstLoad({
          getFromCache: () => null,
          fetchFromApi,
          onData: vi.fn(),
          id: '1',
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load data');
  });

  it('should navigate to /setup when no store configured', () => {
    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { getCurrentStore: () => undefined };
      return selector ? selector(state) : state;
    });

    renderHook(
      () =>
        useCacheFirstLoad({
          getFromCache: () => null,
          fetchFromApi: vi.fn(),
          onData: vi.fn(),
          id: '1',
        }),
      { wrapper }
    );

    expect(mockNavigate).toHaveBeenCalledWith('/setup');
  });

  it('should show refreshing state when cache exists and background fetch occurs', async () => {
    const cachedData = { id: 1, name: 'Cached' };
    const apiData = { id: 1, name: 'Fresh' };
    const fetchFromApi = vi.fn().mockResolvedValue(apiData);

    const { result } = renderHook(
      () =>
        useCacheFirstLoad({
          getFromCache: () => cachedData,
          fetchFromApi,
          onData: vi.fn(),
          id: '1',
        }),
      { wrapper }
    );

    // After cache loaded and background refresh completes
    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
      expect(result.current.loading).toBe(false);
    });

    // fetchFromApi is called with false (background refresh)
    expect(fetchFromApi).toHaveBeenCalledWith(false);
  });

  it('should allow setting data manually', async () => {
    const { result } = renderHook(
      () =>
        useCacheFirstLoad({
          getFromCache: () => null,
          fetchFromApi: vi.fn().mockResolvedValue({ id: 1 }),
          onData: vi.fn(),
          id: '1',
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setData({ id: 99, name: 'Manual' } as unknown as { id: number });
    });

    expect(result.current.data).toEqual({ id: 99, name: 'Manual' });
  });

  it('should allow setting error manually', async () => {
    const { result } = renderHook(
      () =>
        useCacheFirstLoad({
          getFromCache: () => null,
          fetchFromApi: vi.fn().mockResolvedValue({ id: 1 }),
          onData: vi.fn(),
          id: '1',
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setError('Custom error');
    });

    expect(result.current.error).toBe('Custom error');
  });
});
