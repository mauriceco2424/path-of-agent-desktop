/**
 * Vitest Test Setup
 *
 * Configures the test environment with:
 * - @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
 * - Global mocks for browser APIs not available in jsdom
 */

import '@testing-library/jest-dom';

// Mock window.__TAURI__ for tests running outside Tauri
Object.defineProperty(window, '__TAURI__', {
  value: undefined,
  writable: true,
});

// Mock matchMedia for components that use it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: IntersectionObserverMock,
});

// Suppress console errors during tests (optional - uncomment if needed)
// vi.spyOn(console, 'error').mockImplementation(() => {});
