import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportMenu from '../ExportMenu';

describe('ExportMenu', () => {
  const defaultProps = {
    onExportCSV: vi.fn(),
    onExportPDF: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the Export button', () => {
    render(<ExportMenu {...defaultProps} />);

    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('should not show dropdown initially', () => {
    render(<ExportMenu {...defaultProps} />);

    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
    expect(screen.queryByText('Export PDF')).not.toBeInTheDocument();
  });

  it('should show dropdown when button is clicked', () => {
    render(<ExportMenu {...defaultProps} />);

    fireEvent.click(screen.getByText('Export'));

    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Export PDF')).toBeInTheDocument();
  });

  it('should call onExportCSV and close dropdown when CSV is clicked', () => {
    render(<ExportMenu {...defaultProps} />);

    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('Export CSV'));

    expect(defaultProps.onExportCSV).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
  });

  it('should call onExportPDF and close dropdown when PDF is clicked', () => {
    render(<ExportMenu {...defaultProps} />);

    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('Export PDF'));

    expect(defaultProps.onExportPDF).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Export PDF')).not.toBeInTheDocument();
  });

  it('should toggle dropdown on repeated clicks', () => {
    render(<ExportMenu {...defaultProps} />);

    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByText('Export CSV')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Export'));
    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<ExportMenu {...defaultProps} disabled />);

    const button = screen.getByText('Export').closest('button');
    expect(button).toBeDisabled();
  });

  it('should close dropdown on click outside', () => {
    render(
      <div>
        <ExportMenu {...defaultProps} />
        <div data-testid="outside">Outside</div>
      </div>
    );

    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByText('Export CSV')).toBeInTheDocument();

    // Simulate click outside
    fireEvent.mouseDown(screen.getByTestId('outside'));

    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
  });
});
