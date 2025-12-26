import '@testing-library/jest-dom';
import React from 'react';

// Ensure React is available globally for tests
(globalThis as unknown as { React?: typeof React }).React = React;

// Mock Tauri API
if (typeof window !== 'undefined') {
  (window as typeof window & { __TAURI__?: unknown }).__TAURI__ = {
    invoke: jest.fn(),
    tauri: {
      invoke: jest.fn(),
    },
  };
} else {
  // For Node.js test environment
  (
    globalThis as unknown as {
      window?: typeof window & { __TAURI__?: unknown };
    }
  ).window = {
    __TAURI__: {
      invoke: jest.fn(),
      tauri: {
        invoke: jest.fn(),
      },
    },
  } as typeof window;
}

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
