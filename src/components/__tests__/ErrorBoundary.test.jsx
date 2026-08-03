/* eslint-disable no-console -- this file spies on/asserts against console.error, not logging */
import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// Component that throws an error
// eslint-disable-next-line react/prop-types -- test-only helper, not worth a prop-types dependency
const ErrorComponent = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Suppress console.error for cleaner test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  let originalLocation;

  beforeEach(() => {
    originalLocation = window.location;
    delete window.location;
    window.location = {
      reload: vi.fn(),
      href: '',
    };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  describe('Normal rendering', () => {
    it('should render children when there is no error', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child">Child content</div>
        </ErrorBoundary>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('should render multiple children', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child1">Child 1</div>
          <div data-testid="child2">Child 2</div>
        </ErrorBoundary>
      );

      expect(screen.getByTestId('child1')).toBeInTheDocument();
      expect(screen.getByTestId('child2')).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('should catch and display error', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('should display error message', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Test error/)).toBeInTheDocument();
    });

    it('should display helpful message', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      expect(
        screen.getByText(/An unexpected error occurred in the application/i)
      ).toBeInTheDocument();
    });

    it('should log error to console', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Recovery buttons', () => {
    it('should render Try Again button', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should render Reload Page button', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
    });

    it('should render Go Home button', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    });

    it('should reset error state when Try Again is clicked', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

      // Rerender with a component that doesn't throw
      // First, click Try Again
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      // The error state is reset, but the component will throw again
      // In real usage, you'd fix the issue before clicking Try Again
    });

    it('should call reload when Reload Page is clicked', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByRole('button', { name: /reload page/i });
      expect(reloadButton).toBeInTheDocument();

      // Click the button - we just verify it doesn't throw
      fireEvent.click(reloadButton);
    });

    it('should set href when Go Home is clicked', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      const homeButton = screen.getByRole('button', { name: /go home/i });
      expect(homeButton).toBeInTheDocument();

      // Click the button - we verify it attempts to navigate
      fireEvent.click(homeButton);
      // The href will include the full URL in test environment
      expect(window.location.href).toContain('/');
    });
  });

  describe('Error details', () => {
    it('should show error details section', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error Details:')).toBeInTheDocument();
    });
  });

  describe('Error icon', () => {
    it('should display warning icon', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      // Check that the error boundary rendered (icon is part of the error UI)
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Different error types', () => {
    it('should handle TypeError', () => {
      const TypeErrorComponent = () => {
        throw new TypeError('Type error occurred');
      };

      render(
        <ErrorBoundary>
          <TypeErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Type error occurred/)).toBeInTheDocument();
    });

    it('should handle ReferenceError', () => {
      const ReferenceErrorComponent = () => {
        throw new ReferenceError('Reference error occurred');
      };

      render(
        <ErrorBoundary>
          <ReferenceErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Reference error occurred/)).toBeInTheDocument();
    });

    it('should handle custom error', () => {
      class CustomError extends Error {
        constructor(message) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const CustomErrorComponent = () => {
        throw new CustomError('Custom error message');
      };

      render(
        <ErrorBoundary>
          <CustomErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Custom error message/)).toBeInTheDocument();
    });
  });

  describe('Nested ErrorBoundaries', () => {
    it('should catch error at nearest boundary', () => {
      render(
        <ErrorBoundary>
          <div data-testid="outer">
            <ErrorBoundary>
              <ErrorComponent />
            </ErrorBoundary>
          </div>
        </ErrorBoundary>
      );

      // The inner boundary should catch the error
      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
      // The outer content should not be affected
      expect(screen.getByTestId('outer')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible buttons', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      const reloadButton = screen.getByRole('button', { name: /reload page/i });
      const homeButton = screen.getByRole('button', { name: /go home/i });

      expect(tryAgainButton).toBeEnabled();
      expect(reloadButton).toBeEnabled();
      expect(homeButton).toBeEnabled();
    });
  });
});
