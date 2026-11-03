import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnsMenu, SortableTh } from '../ListViewControls';

const cols = [{ key: 'a', label: 'Col A' }];
const open = () => {
  render(
    <div>
      <span>outside</span>
      <ColumnsMenu columns={cols} hidden={[]} onChange={vi.fn()} />
    </div>
  );
  fireEvent.click(screen.getByText('Columns'));
  expect(screen.getByText('Col A')).toBeInTheDocument();
};

describe('ColumnsMenu dismissal', () => {
  it('closes on outside click', () => {
    open();
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByText('Col A')).toBeNull();
  });

  it('stays open on click inside', () => {
    open();
    fireEvent.mouseDown(screen.getByText('Col A'));
    expect(screen.getByText('Col A')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Col A')).toBeNull();
  });
});

describe('SortableTh', () => {
  const renderTh = (sort: { key: string; dir: 'asc' | 'desc' } | null) => {
    const onSort = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortableTh label="Total" sortKey="total" sort={sort} onSort={onSort} />
          </tr>
        </thead>
      </table>
    );
    return onSort;
  };
  const th = () => screen.getByRole('columnheader');

  it('cycles none -> asc -> desc -> none via onSort', () => {
    let onSort = renderTh(null);
    fireEvent.click(screen.getByRole('button', { name: 'Total' }));
    expect(onSort).toHaveBeenCalledWith({ key: 'total', dir: 'asc' });
    document.body.innerHTML = '';
    onSort = renderTh({ key: 'total', dir: 'asc' });
    fireEvent.click(screen.getByRole('button'));
    expect(onSort).toHaveBeenCalledWith({ key: 'total', dir: 'desc' });
    document.body.innerHTML = '';
    onSort = renderTh({ key: 'total', dir: 'desc' });
    fireEvent.click(screen.getByRole('button'));
    expect(onSort).toHaveBeenCalledWith(null);
  });

  it('sorting a different column starts ascending', () => {
    const onSort = renderTh({ key: 'other', dir: 'desc' });
    fireEvent.click(screen.getByRole('button'));
    expect(onSort).toHaveBeenCalledWith({ key: 'total', dir: 'asc' });
    expect(th()).toHaveAttribute('aria-sort', 'none');
  });

  it('exposes aria-sort and a direction icon only for the active column', () => {
    renderTh({ key: 'total', dir: 'desc' });
    expect(th()).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByLabelText('descending')).toBeInTheDocument();
  });
});
