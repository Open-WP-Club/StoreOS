import React from 'react';
import { render, screen } from '@testing-library/react';
import KPICard from '../KPICard';
import { TrendingUp } from 'lucide-react';

describe('KPICard', () => {
  it('should render label and value', () => {
    render(
      <KPICard label="Total Revenue" value="$1,234" changePercent={5.2} direction="up" />
    );

    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('$1,234')).toBeInTheDocument();
  });

  it('should show percentage change', () => {
    render(
      <KPICard label="Revenue" value="$100" changePercent={12.5} direction="up" />
    );

    expect(screen.getByText('12.5%')).toBeInTheDocument();
    expect(screen.getByText('vs prev period')).toBeInTheDocument();
  });

  it('should show "No change" when direction is flat and changePercent is 0', () => {
    render(
      <KPICard label="Revenue" value="$100" changePercent={0} direction="flat" />
    );

    expect(screen.getByText('No change')).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    const { container } = render(
      <KPICard
        label="Revenue"
        value="$100"
        changePercent={5}
        direction="up"
        icon={TrendingUp}
      />
    );

    // Two SVGs: the provided icon + the direction arrow
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it('should not render icon when not provided', () => {
    const { container } = render(
      <KPICard label="Revenue" value="$100" changePercent={5} direction="up" />
    );

    // Only the direction arrow SVG
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(1);
  });

  it('should use green color for "up" direction by default', () => {
    render(
      <KPICard label="Revenue" value="$100" changePercent={5} direction="up" />
    );

    const percentSpan = screen.getByText('5.0%');
    expect(percentSpan.className).toContain('text-green-600');
  });

  it('should use red color for "down" direction by default', () => {
    render(
      <KPICard label="Revenue" value="$100" changePercent={5} direction="down" />
    );

    const percentSpan = screen.getByText('5.0%');
    expect(percentSpan.className).toContain('text-red-600');
  });

  it('should invert colors when invertColors is true', () => {
    // With invertColors, "down" should be green (positive) and "up" should be red (negative)
    render(
      <KPICard
        label="Refund Rate"
        value="2%"
        changePercent={3}
        direction="down"
        invertColors
      />
    );

    const downPercent = screen.getByText('3.0%');
    expect(downPercent.className).toContain('text-green-600');
  });

  it('should show red for "up" when invertColors is true', () => {
    render(
      <KPICard
        label="Refund Rate"
        value="5%"
        changePercent={8}
        direction="up"
        invertColors
      />
    );

    const percent = screen.getByText('8.0%');
    expect(percent.className).toContain('text-red-600');
  });

  it('should display absolute value of changePercent', () => {
    render(
      <KPICard label="Revenue" value="$100" changePercent={-3.7} direction="down" />
    );

    expect(screen.getByText('3.7%')).toBeInTheDocument();
  });
});
