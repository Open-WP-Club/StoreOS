import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import CommandPalette from '../CommandPalette';
import { useSearch, useStoreConfig } from '../../stores';

function Loc(): React.ReactElement {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search}</div>;
}

describe('CommandPalette saved views', () => {
  beforeEach(() => {
    useStoreConfig.setState({ currentStoreId: 's1' });
    useSearch.setState({ savedFilterPresets: [] });
  });

  function open(): void {
    render(
      <MemoryRouter>
        <CommandPalette />
        <Loc />
      </MemoryRouter>
    );
    act(() => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    });
  }

  it('lists a command per visible saved view and navigates with the view id', () => {
    const s = useSearch.getState();
    const mine = s.addFilterPreset({ name: 'Pending', type: 'orders', storeId: 's1' });
    s.addFilterPreset({ name: 'Everywhere', type: 'customers', storeId: 'all' });
    s.addFilterPreset({ name: 'Hidden', type: 'products', storeId: 's2' });
    open();

    expect(screen.getByText('View: Pending')).toBeInTheDocument();
    expect(screen.getByText('View: Everywhere')).toBeInTheDocument();
    expect(screen.queryByText('View: Hidden')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('View: Pending'));
    expect(screen.getByTestId('loc').textContent).toBe(`/orders?view=${mine.id}`);
  });
});
