import { useState, useEffect, useCallback, ReactElement } from 'react';
import { ZoomIn, X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface LightboxImage {
  src: string;
  name: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex: number;
  onClose: () => void;
}

/**
 * Full-screen image lightbox with keyboard navigation.
 */
export function ImageLightbox({ images, initialIndex, onClose }: ImageLightboxProps): ReactElement {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const goNext = useCallback((): void => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback((): void => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goNext, goPrev]);

  const current = images[currentIndex] ?? images[0];
  if (!current) {
    return <></>;
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative max-w-4xl max-h-[90vh] p-4"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
          aria-label="Close lightbox"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-2xl">
          <img
            src={current.src}
            alt={current.name}
            className="max-w-full max-h-[70vh] object-contain mx-auto"
          />
          <div className="p-4 text-center">
            <p className="font-medium text-gray-900 dark:text-white">{current.name}</p>
            {images.length > 1 && (
              <p className="text-xs text-gray-400 mt-1">
                {currentIndex + 1} / {images.length}
              </p>
            )}
          </div>
        </div>

        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 p-3 bg-black/50 rounded-r-lg text-white hover:bg-black/70 transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-3 bg-black/50 rounded-l-lg text-white hover:bg-black/70 transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export { ZoomIn };
export default ImageLightbox;
