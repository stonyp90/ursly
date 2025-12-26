import '@testing-library/jest-dom';

// Mock Tauri API
(
  globalThis as unknown as { window: typeof window & { __TAURI__?: unknown } }
).window = {
  ...globalThis.window,
  __TAURI__: {
    invoke: jest.fn(),
    tauri: {
      invoke: jest.fn(),
    },
  },
};

// Mock import.meta.env for Vite environment variables
(
  globalThis as unknown as { importMetaEnv?: Record<string, unknown> }
).importMetaEnv = {
  MODE: 'test',
  DEV: true,
  PROD: false,
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
