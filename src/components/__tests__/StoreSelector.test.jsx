import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import StoreSelector from '../StoreSelector';
import { useStoreConfig } from '../../stores';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useShallow: (selector) => selector, // Pass through the selector function
}));

describe('StoreSelector', () => {
  const mockNavigate = vi.fn();
  const mockSetCurrentStore = vi.fn();

  const mockStores = [
    { id: '1', name: 'Store 1', url: 'https://store1.com' },
    { id: '2', name: 'Store 2', url: 'https://store2.com' },
  ];

  // Helper function to create mock state
  const createMockState = (stores, currentStoreId) => ({
    stores,
    currentStoreId,
    setCurrentStore: mockSetCurrentStore,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useNavigate.mockReturnValue(mockNavigate);
  });

  it('should not render when there are no stores', () => {
    useStoreConfig.mockImplementation((selector) => {
      const state = createMockState([], null);
      return selector(state);
    });

    const { container } = render(<StoreSelector />);
    expect(container.firstChild).toBeNull();
  });

  it('should render store selector with stores', () => {
    useStoreConfig.mockImplementation((selector) => {
      const state = createMockState(mockStores, '1');
      return selector(state);
    });

    render(<StoreSelector />);

    expect(screen.getByText('Store:')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should display all stores in the dropdown', () => {
    useStoreConfig.mockImplementation((selector) => {
      const state = createMockState(mockStores, '1');
      return selector(state);
    });

    render(<StoreSelector />);

    const select = screen.getByRole('combobox');
    expect(select.children.length).toBe(2);
    expect(screen.getByText(/Store 1/)).toBeInTheDocument();
    expect(screen.getByText(/Store 2/)).toBeInTheDocument();
  });

  it('should show the currently selected store', () => {
    useStoreConfig.mockImplementation((selector) => {
      const state = createMockState(mockStores, '2');
      return selector(state);
    });

    render(<StoreSelector />);

    const select = screen.getByRole('combobox');
    expect(select.value).toBe('2');
  });

  it('should call setCurrentStore when selection changes', () => {
    useStoreConfig.mockImplementation((selector) => {
      const state = createMockState(mockStores, '1');
      return selector(state);
    });

    render(<StoreSelector />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '2' } });

    expect(mockSetCurrentStore).toHaveBeenCalledWith('2');
  });

  it('should navigate to setup page when add store button is clicked', () => {
    useStoreConfig.mockImplementation((selector) => {
      const state = createMockState(mockStores, '1');
      return selector(state);
    });

    render(<StoreSelector />);

    const addButton = screen.getByTitle('Add Store');
    fireEvent.click(addButton);

    expect(mockNavigate).toHaveBeenCalledWith('/setup');
  });

  it('should display store hostname in the option', () => {
    useStoreConfig.mockImplementation((selector) => {
      const state = createMockState(mockStores, '1');
      return selector(state);
    });

    render(<StoreSelector />);

    expect(screen.getByText(/store1.com/)).toBeInTheDocument();
    expect(screen.getByText(/store2.com/)).toBeInTheDocument();
  });
});
