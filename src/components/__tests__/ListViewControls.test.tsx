import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnsMenu } from '../ListViewControls';

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
