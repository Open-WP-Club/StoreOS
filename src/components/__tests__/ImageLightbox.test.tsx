import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageLightbox } from '../ImageLightbox';

const mockImages = [
  { src: 'https://example.com/img1.jpg', name: 'Image 1' },
  { src: 'https://example.com/img2.jpg', name: 'Image 2' },
  { src: 'https://example.com/img3.jpg', name: 'Image 3' },
];

describe('ImageLightbox', () => {
  it('should render the current image', () => {
    render(
      <ImageLightbox images={mockImages} initialIndex={0} onClose={vi.fn()} />
    );

    expect(screen.getByAltText('Image 1')).toBeInTheDocument();
    expect(screen.getByText('Image 1')).toBeInTheDocument();
  });

  it('should show image counter for multiple images', () => {
    render(
      <ImageLightbox images={mockImages} initialIndex={0} onClose={vi.fn()} />
    );

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('should not show image counter for single image', () => {
    render(
      <ImageLightbox images={[mockImages[0]!]} initialIndex={0} onClose={vi.fn()} />
    );

    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });

  it('should show navigation buttons for multiple images', () => {
    render(
      <ImageLightbox images={mockImages} initialIndex={0} onClose={vi.fn()} />
    );

    expect(screen.getByLabelText('Previous image')).toBeInTheDocument();
    expect(screen.getByLabelText('Next image')).toBeInTheDocument();
  });

  it('should not show navigation buttons for single image', () => {
    render(
      <ImageLightbox images={[mockImages[0]!]} initialIndex={0} onClose={vi.fn()} />
    );

    expect(screen.queryByLabelText('Previous image')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Next image')).not.toBeInTheDocument();
  });

  it('should navigate to next image when clicking Next', () => {
    render(
      <ImageLightbox images={mockImages} initialIndex={0} onClose={vi.fn()} />
    );

    fireEvent.click(screen.getByLabelText('Next image'));

    expect(screen.getByAltText('Image 2')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('should navigate to previous image when clicking Previous', () => {
    render(
      <ImageLightbox images={mockImages} initialIndex={1} onClose={vi.fn()} />
    );

    fireEvent.click(screen.getByLabelText('Previous image'));

    expect(screen.getByAltText('Image 1')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('should wrap around when navigating past last image', () => {
    render(
      <ImageLightbox images={mockImages} initialIndex={2} onClose={vi.fn()} />
    );

    fireEvent.click(screen.getByLabelText('Next image'));

    expect(screen.getByAltText('Image 1')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('should wrap around when navigating before first image', () => {
    render(
      <ImageLightbox images={mockImages} initialIndex={0} onClose={vi.fn()} />
    );

    fireEvent.click(screen.getByLabelText('Previous image'));

    expect(screen.getByAltText('Image 3')).toBeInTheDocument();
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <ImageLightbox images={mockImages} initialIndex={0} onClose={onClose} />
    );

    fireEvent.click(screen.getByLabelText('Close lightbox'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ImageLightbox images={mockImages} initialIndex={0} onClose={onClose} />
    );

    // Click the outermost backdrop div
    const backdrop = container.firstChild;
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not close when clicking on the image content', () => {
    const onClose = vi.fn();
    render(
      <ImageLightbox images={mockImages} initialIndex={0} onClose={onClose} />
    );

    // Click on the image itself
    fireEvent.click(screen.getByAltText('Image 1'));

    // stopPropagation prevents onClose from being called via the content area
    // But the image is inside the content div, so onClose should not be called
    // (the parent div with stopPropagation catches it)
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should navigate with keyboard ArrowRight', () => {
    render(
      <ImageLightbox images={mockImages} initialIndex={0} onClose={vi.fn()} />
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(screen.getByAltText('Image 2')).toBeInTheDocument();
  });

  it('should navigate with keyboard ArrowLeft', () => {
    render(
      <ImageLightbox images={mockImages} initialIndex={1} onClose={vi.fn()} />
    );

    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    expect(screen.getByAltText('Image 1')).toBeInTheDocument();
  });

  it('should close with Escape key', () => {
    const onClose = vi.fn();
    render(
      <ImageLightbox images={mockImages} initialIndex={0} onClose={onClose} />
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should render empty fragment for empty images array', () => {
    const { container } = render(
      <ImageLightbox images={[]} initialIndex={0} onClose={vi.fn()} />
    );

    // Should render nothing
    expect(container.innerHTML).toBe('');
  });

  it('should start at the specified initialIndex', () => {
    render(
      <ImageLightbox images={mockImages} initialIndex={2} onClose={vi.fn()} />
    );

    expect(screen.getByAltText('Image 3')).toBeInTheDocument();
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });
});
