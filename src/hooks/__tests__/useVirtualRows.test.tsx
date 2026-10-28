import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useVirtualRows, VIRTUALIZE_THRESHOLD } from '../useVirtualRows';
import OrdersTable from '../../components/OrdersTable';
import { createMockOrder } from '../../__test_utils__/mockFactories';

const VIEWPORT = 560; // 10 rows at the default 56px estimate
const proto = HTMLElement.prototype;
const saved: Record<string, PropertyDescriptor | undefined> = {};

beforeEach(() => {
  // jsdom has no layout: give every element a fixed size so the virtualizer sees a viewport.
  for (const k of ['clientHeight', 'clientWidth', 'getBoundingClientRect']) {
    saved[k] = Object.getOwnPropertyDescriptor(proto, k);
  }
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => VIEWPORT });
  Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => 800 });
  proto.getBoundingClientRect = () =>
    ({
      width: 800,
      height: VIEWPORT,
      top: 0,
      left: 0,
      right: 800,
      bottom: VIEWPORT,
      x: 0,
      y: 0,
    }) as DOMRect;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  for (const [k, d] of Object.entries(saved)) {
    if (d) Object.defineProperty(proto, k, d);
    else delete (proto as unknown as Record<string, unknown>)[k];
  }
  vi.unstubAllGlobals();
});

function Harness({ n }: { n: number }) {
  const items = Array.from({ length: n }, (_, i) => i);
  const { scrollContainer, enabled, rows, padTop, padBottom } = useVirtualRows(items);
  return (
    <div ref={scrollContainer} data-testid="scroller" data-enabled={String(enabled)}>
      <span data-testid="pads">{`${padTop}|${padBottom}`}</span>
      {rows.map((r) => (
        <i key={r} data-testid="row" />
      ))}
    </div>
  );
}

const pads = (): number[] => screen.getByTestId('pads').textContent!.split('|').map(Number);

describe('useVirtualRows', () => {
  it('renders every row without spacers at or below the threshold', () => {
    render(<Harness n={VIRTUALIZE_THRESHOLD} />);
    expect(screen.getAllByTestId('row')).toHaveLength(VIRTUALIZE_THRESHOLD);
    expect(screen.getByTestId('scroller').dataset.enabled).toBe('false');
    expect(pads()).toEqual([0, 0]);
  });

  it('windows rows above the threshold and pads the remainder', () => {
    const n = 500;
    render(<Harness n={n} />);
    const count = screen.getAllByTestId('row').length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(n);
    const [top, bottom] = pads();
    expect(top).toBe(0);
    expect(top! + count * 56 + bottom!).toBe(n * 56);
  });

  it('moves the window and top spacer on scroll', () => {
    render(<Harness n={500} />);
    const scroller = screen.getByTestId('scroller');
    scroller.scrollTop = 56 * 200;
    fireEvent.scroll(scroller);
    const [top, bottom] = pads();
    expect(top).toBeGreaterThan(0);
    expect(top! + screen.getAllByTestId('row').length * 56 + bottom!).toBe(500 * 56);
  });
});

describe('OrdersTable virtualization', () => {
  const orders = Array.from({ length: 300 }, (_, i) => createMockOrder({ id: i + 1 }));
  const renderTable = (list = orders, selected: number[] = []) => {
    const onSelectAll = vi.fn();
    render(
      <MemoryRouter>
        <OrdersTable
          paginatedOrders={list}
          selectedOrderIds={selected}
          onSelectAll={onSelectAll}
          onSelectOrder={vi.fn()}
          onStatusChange={vi.fn().mockResolvedValue(undefined)}
          currentPage={1}
          totalItems={list.length}
          pageSize={300}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
        />
      </MemoryRouter>
    );
    return onSelectAll;
  };

  it('renders a window of rows plus aria-hidden spacer row(s)', () => {
    renderTable();
    const dataRows = document.querySelectorAll('tbody tr:not([aria-hidden])');
    expect(dataRows.length).toBeGreaterThan(0);
    expect(dataRows.length).toBeLessThan(orders.length);
    expect(document.querySelectorAll('tbody tr[aria-hidden="true"]').length).toBeGreaterThanOrEqual(
      1
    );
  });

  it('select-all state and handler work on data, not on rendered DOM rows', () => {
    const onSelectAll = renderTable(
      orders,
      orders.map((o) => o.id)
    );
    const box = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    expect(box.checked).toBe(true); // all 300 selected though only a window is in the DOM
    fireEvent.click(box);
    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('is not virtualized for small lists', () => {
    renderTable(orders.slice(0, 10));
    expect(document.querySelectorAll('tbody tr[aria-hidden="true"]')).toHaveLength(0);
    expect(document.querySelectorAll('tbody tr')).toHaveLength(10);
  });
});
