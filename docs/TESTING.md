# Testing Guide for StoreOS - Built for WooCommerce

This document provides comprehensive information about the testing infrastructure and practices for the StoreOS - Built for WooCommerce project.

## Table of Contents

- [Overview](#overview)
- [Test Framework](#test-framework)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Test Coverage](#test-coverage)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)

## Overview

The project uses **Jest** as the testing framework with **React Testing Library** for component testing. The test suite includes:

- **Unit tests** for utility functions
- **Integration tests** for hooks and state management
- **Component tests** for React components
- **Service tests** for API interactions

## Test Framework

### Dependencies

- **jest**: Testing framework (v29.7.0)
- **@testing-library/react**: React component testing utilities
- **@testing-library/jest-dom**: Custom Jest matchers for DOM
- **@testing-library/user-event**: User interaction simulation
- **babel-jest**: Babel transformer for Jest
- **jest-environment-jsdom**: DOM environment for testing

### Configuration

Test configuration is defined in `jest.config.js`:

```javascript
{
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/main.jsx',
    '!src/**/*.test.{js,jsx}',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
}
```

### Setup File

The `jest.setup.js` file configures the test environment with necessary mocks for localStorage and IndexedDB.

## Running Tests

### Available Commands

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage report
pnpm run test:coverage

# Run specific test file
pnpm test -- path/to/test.js

# Run tests matching a pattern
pnpm test -- --testNamePattern="should render"
```

### Watch Mode

Watch mode automatically reruns tests when files change. Useful commands:
- Press `a` to run all tests
- Press `f` to run only failed tests
- Press `p` to filter by filename pattern
- Press `t` to filter by test name pattern
- Press `q` to quit

## Test Structure

Tests are organized using the `__tests__` pattern alongside the code they test:

```
src/
├── components/
│   ├── __tests__/
│   │   ├── Toast.test.jsx
│   │   ├── Pagination.test.jsx
│   │   ├── LoadingIndicator.test.jsx
│   │   └── StoreSelector.test.jsx
│   └── Toast.jsx
├── hooks/
│   ├── __tests__/
│   │   ├── useToast.test.js
│   │   ├── useProgressiveLoading.test.js
│   │   └── useKeyboardShortcut.test.js
│   └── useToast.js
├── utils/
│   ├── __tests__/
│   │   ├── currency.test.js
│   │   ├── dateTime.test.js
│   │   ├── searchService.test.js
│   │   ├── logger.test.js
│   │   ├── csvExport.test.js
│   │   └── indexedDBCache.test.js
│   └── currency.js
├── stores/
│   ├── __tests__/
│   │   └── useStore.test.js
│   └── useStore.js
└── services/
    ├── __tests__/
    │   └── woocommerce.test.js
    └── woocommerce.js
```

## Test Coverage

Current test coverage includes:

### Utilities (100% coverage)
- ✅ `currency.js` - Currency formatting and conversion
- ✅ `dateTime.js` - Date and time utilities
- ✅ `searchService.js` - Search and filtering functionality
- ✅ `logger.js` - Logging utilities
- ✅ `csvExport.js` - CSV export functionality
- ✅ `indexedDBCache.js` - IndexedDB caching

### Hooks (100% coverage)
- ✅ `useToast.js` - Toast notification management
- ✅ `useProgressiveLoading.js` - Progressive data loading
- ✅ `useKeyboardShortcut.js` - Keyboard shortcut handling

### Stores (100% coverage)
- ✅ `useStore.js` - Zustand global state management

### Components
- ✅ `Toast.jsx` - Toast notification component
- ✅ `Pagination.jsx` - Pagination controls
- ✅ `LoadingIndicator.jsx` - Loading progress indicator
- ✅ `StoreSelector.jsx` - Store selection component

### Services
- ✅ `woocommerce.js` - WooCommerce API service

### Viewing Coverage Reports

Generate a coverage report:

```bash
pnpm run test:coverage
```

Coverage report locations:
- **Terminal**: Summary displayed in console
- **HTML**: `coverage/lcov-report/index.html` (open in browser)
- **LCOV**: `coverage/lcov.info` (for CI/CD)

### Coverage Thresholds

Minimum coverage thresholds (enforced):
- **Branches**: 50%
- **Functions**: 50%
- **Lines**: 50%
- **Statements**: 50%

## Writing Tests

### Component Testing Example

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });

  it('should handle user interactions', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();

    render(<MyComponent onClick={handleClick} />);
    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalled();
  });
});
```

### Hook Testing Example

```javascript
import { renderHook, act } from '@testing-library/react';
import useMyHook from '../useMyHook';

describe('useMyHook', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.value).toBe(defaultValue);
  });

  it('should update state on action', () => {
    const { result } = renderHook(() => useMyHook());

    act(() => {
      result.current.updateValue(newValue);
    });

    expect(result.current.value).toBe(newValue);
  });
});
```

## Best Practices

### General Guidelines

1. **Write Clear Test Names**: Use descriptive names that explain what is being tested
2. **Follow AAA Pattern**: Arrange, Act, Assert
3. **Test Behavior, Not Implementation**: Test what the component does, not how
4. **Use Semantic Queries**: Prefer getByRole, getByLabelText over testId
5. **Mock External Dependencies**: Mock API calls, timers, and external modules
6. **Clean Up After Tests**: Use beforeEach/afterEach for setup and teardown

### Async Testing

```javascript
it('should load data', async () => {
  render(<MyComponent />);

  // Wait for element to appear
  const element = await screen.findByText('Loaded data');
  expect(element).toBeInTheDocument();

  // Or use waitFor
  await waitFor(() => {
    expect(screen.getByText('Loaded data')).toBeInTheDocument();
  });
});
```

### Mocking

```javascript
// Mock functions
const mockFn = jest.fn();
mockFn.mockReturnValue('value');
mockFn.mockResolvedValue('async value');

// Mock modules
jest.mock('../utils/api', () => ({
  fetchData: jest.fn().mockResolvedValue({ data: [] }),
}));

// Mock timers
jest.useFakeTimers();
jest.advanceTimersByTime(1000);
jest.useRealTimers();
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)

---

**Last Updated**: 2025-11-17
**Test Framework**: Jest 29.7.0
**Coverage Target**: 50% minimum

## Coverage Thresholds

The project maintains the following coverage thresholds:

- **Branches**: 50%
- **Functions**: 50%
- **Lines**: 50%
- **Statements**: 50%

These thresholds are configured in `jest.config.js` and can be adjusted as the test suite matures.

## Writing Tests

### Utility Function Tests

Example test for a utility function:

```javascript
import { formatPrice } from '../currency';

describe('formatPrice', () => {
  it('should format price with currency symbol', () => {
    expect(formatPrice('10.00', '$')).toBe('$10.00');
  });
});
```

### Component Tests

Example test for a React component:

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Service Tests

Example test for a service with mocked dependencies:

```javascript
import axios from 'axios';
import WooCommerceService from '../woocommerce';

jest.mock('axios');

describe('WooCommerceService', () => {
  it('should fetch orders', async () => {
    const mockOrders = [{ id: 1 }];
    axios.create.mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: mockOrders }),
    });

    const service = new WooCommerceService({ url: 'https://test.com' });
    const result = await service.getOrders();

    expect(result.data).toEqual(mockOrders);
  });
});
```

## Continuous Integration

The project uses GitHub Actions for CI/CD:

### CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request to main branches:
- Lints code
- Checks code formatting
- Runs all tests with coverage
- Builds the application

### Release Workflow (`.github/workflows/release.yml`)

Triggered when a version tag is pushed (e.g., `v1.0.0`):
1. Runs all tests
2. Builds for Windows, Linux, and macOS
3. Creates a GitHub release with all build artifacts

## Creating a Release

To create a new release:

1. Update the version in `package.json`:
   ```bash
   pnpm version patch  # or minor, or major
   ```

2. Push the tag to GitHub:
   ```bash
   git push origin --tags
   ```

3. GitHub Actions will automatically:
   - Run tests
   - Build for all platforms
   - Create a release with binaries

## Build Artifacts

The release workflow produces the following artifacts:

### macOS
- `.dmg` - Disk image installer
- `.zip` - Compressed application bundle
- Supports both Intel (x64) and Apple Silicon (arm64)

### Windows
- `.exe` - NSIS installer (x64 and x86)
- Portable executable (x64)

### Linux
- `.AppImage` - Universal Linux application
- `.deb` - Debian/Ubuntu package
- `.rpm` - Fedora/RedHat package

## Troubleshooting

### Tests failing locally but passing in CI

Make sure your dependencies are up to date:
```bash
pnpm install --frozen-lockfile  # Clean install based on pnpm-lock.yaml
```

### Jest can't find modules

Check that:
1. The module path in the import is correct
2. The module is not a CSS/asset file (should be mocked in `jest.config.js`)

### Component tests failing with "not wrapped in act(...)"

This usually means async state updates aren't being awaited. Use `waitFor` or `findBy*` queries:

```javascript
import { waitFor } from '@testing-library/react';

await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

## Best Practices

1. **Test behavior, not implementation** - Focus on what the user sees and does
2. **Use meaningful test descriptions** - Describe what should happen
3. **Keep tests isolated** - Each test should be independent
4. **Mock external dependencies** - Don't make real API calls in tests
5. **Use data-testid sparingly** - Prefer accessible queries (getByRole, getByText)
6. **Test error cases** - Don't just test the happy path

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [Common Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
