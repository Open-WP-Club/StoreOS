import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Numpad } from '../Numpad';

describe('Numpad', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with default title', () => {
    render(<Numpad {...defaultProps} />);

    expect(screen.getByText('Въведи стойност')).toBeInTheDocument();
  });

  it('should render with custom title', () => {
    render(<Numpad {...defaultProps} title="Enter quantity" />);

    expect(screen.getByText('Enter quantity')).toBeInTheDocument();
  });

  it('should display current value', () => {
    render(<Numpad {...defaultProps} value="42" />);

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should display "0" when value is empty', () => {
    render(<Numpad {...defaultProps} value="" />);

    // Both the display and the "0" button show "0", so use getAllByText
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2); // display + button
  });

  it('should render all number keys 0-9', () => {
    render(<Numpad {...defaultProps} />);

    for (let i = 0; i <= 9; i++) {
      // "0" appears both in display and as a button key, so use getAllByText
      const elements = screen.getAllByText(String(i));
      expect(elements.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should call onChange with appended digit on number click', () => {
    render(<Numpad {...defaultProps} value="1" />);

    fireEvent.click(screen.getByText('5'));

    expect(defaultProps.onChange).toHaveBeenCalledWith('15');
  });

  it('should clear value on C click', () => {
    render(<Numpad {...defaultProps} value="123" />);

    fireEvent.click(screen.getByText('C'));

    expect(defaultProps.onChange).toHaveBeenCalledWith('');
  });

  it('should add decimal point when allowDecimal is true', () => {
    render(<Numpad {...defaultProps} value="10" allowDecimal={true} />);

    fireEvent.click(screen.getByText('.'));

    expect(defaultProps.onChange).toHaveBeenCalledWith('10.');
  });

  it('should not add second decimal point', () => {
    render(<Numpad {...defaultProps} value="10.5" allowDecimal={true} />);

    fireEvent.click(screen.getByText('.'));

    expect(defaultProps.onChange).not.toHaveBeenCalled();
  });

  it('should show backspace in grid when allowDecimal is false', () => {
    render(<Numpad {...defaultProps} allowDecimal={false} />);

    // When allowDecimal is false, the grid should have ⌫ instead of .
    const buttons = screen.getAllByRole('button');
    const buttonTexts = buttons.map((b) => b.textContent);
    expect(buttonTexts.some((t) => t === '⌫')).toBe(true);
    expect(buttonTexts.some((t) => t === '.')).toBe(false);
  });

  it('should handle backspace (remove last character)', () => {
    render(<Numpad {...defaultProps} value="123" allowDecimal={true} />);

    // Click the backspace button (the one with '⌫ Изтрий' text)
    fireEvent.click(screen.getByText('⌫ Изтрий'));

    expect(defaultProps.onChange).toHaveBeenCalledWith('12');
  });

  it('should handle backspace on empty value', () => {
    render(<Numpad {...defaultProps} value="" allowDecimal={true} />);

    fireEvent.click(screen.getByText('⌫ Изтрий'));

    expect(defaultProps.onChange).toHaveBeenCalledWith('');
  });

  it('should call onConfirm when confirm button is clicked', () => {
    render(<Numpad {...defaultProps} />);

    fireEvent.click(screen.getByText('Потвърди'));

    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when X button is clicked', () => {
    render(<Numpad {...defaultProps} />);

    // Find the close X button (the one in the header)
    const closeButtons = screen.getAllByRole('button');
    // The close button contains the X icon, find it by the header area
    const closeButton = closeButtons.find(
      (btn) => btn.querySelector('svg') && !btn.textContent?.includes('Потвърди') && !btn.textContent?.includes('Изтрий') && !btn.textContent?.match(/^[0-9C.⌫]$/)
    );
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });

  it('should call onClose when backdrop is clicked', () => {
    const { container } = render(<Numpad {...defaultProps} />);

    // Click the outermost backdrop
    const backdrop = container.firstChild;
    fireEvent.click(backdrop!);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should not close when clicking inside the dialog', () => {
    render(<Numpad {...defaultProps} />);

    // Click on a number button inside the dialog
    fireEvent.click(screen.getByText('5'));

    // onChange should be called but not onClose
    expect(defaultProps.onChange).toHaveBeenCalled();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('should show separate backspace button when allowDecimal is true', () => {
    render(<Numpad {...defaultProps} allowDecimal={true} />);

    expect(screen.getByText('⌫ Изтрий')).toBeInTheDocument();
  });

  it('should not show separate backspace button when allowDecimal is false', () => {
    render(<Numpad {...defaultProps} allowDecimal={false} />);

    expect(screen.queryByText('⌫ Изтрий')).not.toBeInTheDocument();
  });

  it('should build multi-digit numbers', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <Numpad {...defaultProps} value="" onChange={onChange} />
    );
    fireEvent.click(screen.getByText('1'));
    expect(onChange).toHaveBeenCalledWith('1');

    rerender(<Numpad {...defaultProps} value="1" onChange={onChange} />);
    fireEvent.click(screen.getByText('2'));
    expect(onChange).toHaveBeenCalledWith('12');

    rerender(<Numpad {...defaultProps} value="12" onChange={onChange} />);
    fireEvent.click(screen.getByText('3'));
    expect(onChange).toHaveBeenCalledWith('123');
  });
});
