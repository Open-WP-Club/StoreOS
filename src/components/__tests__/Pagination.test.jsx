import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from '../Pagination';

describe('Pagination', () => {
  const defaultProps = {
    currentPage: 1,
    totalItems: 100,
    pageSize: 25,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render pagination with correct info', () => {
    render(<Pagination {...defaultProps} />);

    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    // Use getAllByText since numbers appear in both info text and controls
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('25').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100').length).toBeGreaterThan(0);
  });

  it('should calculate total pages correctly', () => {
    render(<Pagination {...defaultProps} totalItems={100} pageSize={25} />);

    // Should show pages 1-4
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('should disable Previous button on first page', () => {
    render(<Pagination {...defaultProps} currentPage={1} />);

    const prevButton = screen.getByText('Previous');
    expect(prevButton).toBeDisabled();
  });

  it('should disable Next button on last page', () => {
    render(<Pagination {...defaultProps} currentPage={4} totalItems={100} pageSize={25} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('should enable Previous button when not on first page', () => {
    render(<Pagination {...defaultProps} currentPage={2} />);

    const prevButton = screen.getByText('Previous');
    expect(prevButton).not.toBeDisabled();
  });

  it('should enable Next button when not on last page', () => {
    render(<Pagination {...defaultProps} currentPage={1} totalItems={100} pageSize={25} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();
  });

  it('should call onPageChange when clicking page number', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(<Pagination {...defaultProps} onPageChange={onPageChange} />);

    const page2Button = screen.getByText('2');
    await user.click(page2Button);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('should call onPageChange when clicking Next', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(<Pagination {...defaultProps} currentPage={1} onPageChange={onPageChange} />);

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('should call onPageChange when clicking Previous', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(<Pagination {...defaultProps} currentPage={2} onPageChange={onPageChange} />);

    const prevButton = screen.getByText('Previous');
    await user.click(prevButton);

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('should call onPageSizeChange when changing page size', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();

    render(<Pagination {...defaultProps} onPageSizeChange={onPageSizeChange} />);

    const select = screen.getByLabelText('Per page:');
    await user.selectOptions(select, '50');

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('should highlight current page', () => {
    render(<Pagination {...defaultProps} currentPage={2} />);

    const page2Button = screen.getByText('2');
    expect(page2Button).toHaveClass('bg-blue-600');
  });

  it('should show all pages when total pages <= 5', () => {
    render(<Pagination {...defaultProps} totalItems={100} pageSize={25} />);

    // Should show pages 1, 2, 3, 4
    expect(screen.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 4' })).toBeInTheDocument();
  });

  it('should show ellipsis when total pages > 5', () => {
    render(<Pagination {...defaultProps} totalItems={250} pageSize={25} currentPage={5} />);

    // Should show ellipsis (rendered as unicode character …)
    const ellipses = screen.getAllByText('…');
    expect(ellipses.length).toBeGreaterThan(0);
  });

  it('should render custom page size options', () => {
    render(
      <Pagination {...defaultProps} pageSizeOptions={[10, 20, 30]} />
    );

    const select = screen.getByLabelText('Per page:');
    const options = Array.from(select.options).map((o) => Number(o.value));

    expect(options).toEqual([10, 20, 30]);
  });

  it('should display correct item range', () => {
    render(<Pagination {...defaultProps} currentPage={2} totalItems={100} pageSize={25} />);

    expect(screen.getByText('26')).toBeInTheDocument(); // startItem
    // '50' appears in both info text and page size dropdown
    expect(screen.getAllByText('50').length).toBeGreaterThan(0);
  });

  it('should handle zero items correctly', () => {
    render(<Pagination {...defaultProps} totalItems={0} pageSize={25} />);

    // '0' appears multiple times in "Showing 0 to 0 of 0"
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('should handle last page with partial items correctly', () => {
    render(<Pagination {...defaultProps} currentPage={4} totalItems={85} pageSize={25} />);

    expect(screen.getByText('76')).toBeInTheDocument(); // startItem
    // '85' appears twice in "Showing 76 to 85 of 85"
    expect(screen.getAllByText('85').length).toBeGreaterThan(0);
  });

  it('should show correct pages when near the beginning', () => {
    render(<Pagination {...defaultProps} totalItems={250} pageSize={25} currentPage={2} />);

    // Should show 1, 2, 3, 4, ..., 10
    expect(screen.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 10' })).toBeInTheDocument();
  });

  it('should show correct pages when near the end', () => {
    render(<Pagination {...defaultProps} totalItems={250} pageSize={25} currentPage={9} />);

    // Should show 1, ..., 7, 8, 9, 10
    expect(screen.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 7' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 8' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 9' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 10' })).toBeInTheDocument();
  });
});
