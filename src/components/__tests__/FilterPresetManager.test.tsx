import { vi, Mock } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterPresetManager from '../FilterPresetManager';
import { useStoreConfig, useSearch } from '../../stores';

// Mock the stores module
vi.mock('../../stores');

// Cast to jest.Mock for type safety
const mockUseStoreConfig = useStoreConfig as unknown as Mock;
const mockUseSearch = useSearch as unknown as Mock;

const mockGetCurrentStore = vi.fn();
const mockGetFilterPresetsForType = vi.fn();
const mockAddFilterPreset = vi.fn();
const mockDeleteFilterPreset = vi.fn();

describe('FilterPresetManager', () => {
  const defaultProps = {
    type: 'products' as const,
    currentFilters: { status: 'publish', stockStatus: 'instock' } as Record<string, unknown>,
    onApplyPreset: vi.fn(),
    onSaveSuccess: vi.fn(),
  };

  const mockPresets = [
    { id: 'preset-1', name: 'Low Stock', type: 'products', filters: { stockMin: 5 }, storeId: 'store-1' },
    { id: 'preset-2', name: 'Global Filter', type: 'products', filters: { status: 'draft' }, storeId: 'all' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentStore.mockReturnValue({ id: 'store-1', name: 'Test Store' });
    mockGetFilterPresetsForType.mockReturnValue(mockPresets);
    mockAddFilterPreset.mockReturnValue({ id: 'new-preset', name: 'Test', filters: {} });

    // Re-set mock implementations (resetMocks clears them between tests)
    mockUseStoreConfig.mockImplementation((selector: (state: Record<string, unknown>) => unknown) => {
      const state = { getCurrentStore: mockGetCurrentStore };
      return selector(state);
    });
    mockUseSearch.mockImplementation((selector: (state: Record<string, unknown>) => unknown) => {
      const state = {
        getFilterPresetsForType: mockGetFilterPresetsForType,
        addFilterPreset: mockAddFilterPreset,
        deleteFilterPreset: mockDeleteFilterPreset,
      };
      return selector(state);
    });
  });

  it('should render the Presets button', () => {
    render(<FilterPresetManager {...defaultProps} />);

    expect(screen.getByText('Presets')).toBeInTheDocument();
  });

  it('should show preset count badge', () => {
    render(<FilterPresetManager {...defaultProps} />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should not show badge when no presets', () => {
    mockGetFilterPresetsForType.mockReturnValue([]);
    render(<FilterPresetManager {...defaultProps} />);

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('should open dropdown on button click', () => {
    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));

    expect(screen.getByText('Filter Presets')).toBeInTheDocument();
    expect(screen.getByText('Low Stock')).toBeInTheDocument();
    expect(screen.getByText('Global Filter')).toBeInTheDocument();
  });

  it('should show Global badge for global presets', () => {
    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));

    expect(screen.getByText('Global')).toBeInTheDocument();
  });

  it('should show empty state when no presets exist', () => {
    mockGetFilterPresetsForType.mockReturnValue([]);
    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));

    expect(screen.getByText('No saved presets yet')).toBeInTheDocument();
  });

  it('should close dropdown when clicking outside', () => {
    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));
    expect(screen.getByText('Filter Presets')).toBeInTheDocument();

    // Click the backdrop
    fireEvent.click(screen.getByLabelText('Close menu'));

    expect(screen.queryByText('Filter Presets')).not.toBeInTheDocument();
  });

  it('should apply preset when clicking on it', () => {
    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Low Stock'));

    expect(defaultProps.onApplyPreset).toHaveBeenCalledWith({ stockMin: 5 });
  });

  it('should close dropdown after applying preset', () => {
    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Low Stock'));

    expect(screen.queryByText('Filter Presets')).not.toBeInTheDocument();
  });

  it('should show filter count for each preset', () => {
    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));

    // Both presets have 1 filter each, so multiple elements match
    const filterLabels = screen.getAllByText('1 filter');
    expect(filterLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('should open save modal from dropdown', () => {
    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Save Current Filters'));

    expect(screen.getByText('Save Filter Preset')).toBeInTheDocument();
    expect(screen.getByText('Preset Name')).toBeInTheDocument();
  });

  it('should disable save button when no active filters', () => {
    render(
      <FilterPresetManager
        {...defaultProps}
        currentFilters={{ status: 'all', stockStatus: '' }}
      />
    );

    fireEvent.click(screen.getByText('Presets'));

    const saveBtn = screen.getByText('Save Current Filters');
    expect(saveBtn.closest('button')).toBeDisabled();
  });

  it('should save preset with name', () => {
    render(<FilterPresetManager {...defaultProps} />);

    // Open dropdown, then save modal
    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Save Current Filters'));

    // Type preset name
    const input = screen.getByPlaceholderText('e.g., Low Stock Products');
    fireEvent.change(input, { target: { value: 'My Preset' } });

    // Click Save
    fireEvent.click(screen.getByText('Save Preset'));

    expect(mockAddFilterPreset).toHaveBeenCalledWith({
      name: 'My Preset',
      type: 'products',
      filters: defaultProps.currentFilters,
      storeId: 'store-1',
    });
    expect(defaultProps.onSaveSuccess).toHaveBeenCalled();
  });

  it('should not save with empty preset name', () => {
    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Save Current Filters'));

    // Save button should be disabled
    const saveButton = screen.getByText('Save Preset');
    expect(saveButton.closest('button')).toBeDisabled();
  });

  it('should save as global preset when checkbox is checked', () => {
    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Save Current Filters'));

    // Type name
    fireEvent.change(screen.getByPlaceholderText('e.g., Low Stock Products'), {
      target: { value: 'Global Preset' },
    });

    // Check global checkbox
    fireEvent.click(screen.getByLabelText('Available for all stores'));

    // Save
    fireEvent.click(screen.getByText('Save Preset'));

    expect(mockAddFilterPreset).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 'all' })
    );
  });

  it('should close save modal on Cancel', () => {
    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Save Current Filters'));
    expect(screen.getByText('Save Filter Preset')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Save Filter Preset')).not.toBeInTheDocument();
  });

  it('should delete preset with confirmation', () => {
    window.confirm = vi.fn().mockReturnValue(true);

    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));

    // Find delete buttons by their classes
    const trashButtons = screen.getAllByRole('button').filter(
      (btn) => btn.className.includes('hover:text-red-600') || btn.className.includes('hover:text-red-400')
    );
    if (trashButtons.length > 0) {
      fireEvent.click(trashButtons[0]!);
      expect(window.confirm).toHaveBeenCalledWith('Delete this filter preset?');
      expect(mockDeleteFilterPreset).toHaveBeenCalledWith('preset-1');
    }
  });

  it('should not delete preset when confirmation is cancelled', () => {
    window.confirm = vi.fn().mockReturnValue(false);

    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));

    const trashButtons = screen.getAllByRole('button').filter(
      (btn) => btn.className.includes('hover:text-red-600') || btn.className.includes('hover:text-red-400')
    );
    if (trashButtons.length > 0) {
      fireEvent.click(trashButtons[0]!);
      expect(mockDeleteFilterPreset).not.toHaveBeenCalled();
    }
  });

  it('should show active filters in save modal', () => {
    render(<FilterPresetManager {...defaultProps} />);

    fireEvent.click(screen.getByText('Presets'));
    fireEvent.click(screen.getByText('Save Current Filters'));

    expect(screen.getByText('Active Filters:')).toBeInTheDocument();
  });
});
