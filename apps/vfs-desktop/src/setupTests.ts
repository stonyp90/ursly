import '@testing-library/jest-dom';
import React from 'react';

// Ensure React is available globally for tests
if (typeof globalThis !== 'undefined') {
  (globalThis as any).React = React;
}

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

// Mock import.meta for Jest (needs to be available before modules are loaded)
// This is a workaround for Jest not supporting import.meta syntax
if (typeof globalThis !== 'undefined') {
  // Create a mock import object
  const mockImportMeta = {
    env: {
      MODE: 'test',
      DEV: 'true',
      PROD: 'false',
      VITE_API_ENDPOINT: '',
      VITE_KEYCLOAK_URL: '',
      VITE_KEYCLOAK_REALM: '',
      VITE_KEYCLOAK_CLIENT_ID: '',
      VITE_API_URL: '',
      VITE_WS_URL: '',
    },
  };

  // Use Object.defineProperty to make it non-enumerable
  Object.defineProperty(globalThis, 'import', {
    value: { meta: mockImportMeta },
    writable: true,
    configurable: true,
    enumerable: false,
  });

  // Also set importMeta for direct access
  Object.defineProperty(globalThis, 'importMeta', {
    value: mockImportMeta,
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

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

// Mock Element.prototype.closest for jsdom
if (!Element.prototype.closest) {
  Element.prototype.closest = function (selector: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let element: Element | null = this;
    while (element) {
      if (element.matches(selector)) {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  };
}

// Mock DragEvent for jsdom (not available by default)
if (typeof DragEvent === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).DragEvent = class DragEvent extends Event {
    dataTransfer: DataTransfer | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    effectAllowed: any;
    dropEffect: string;

    constructor(type: string, eventInitDict?: DragEventInit) {
      super(type, eventInitDict);
      this.dataTransfer = eventInitDict?.dataTransfer || null;

      this.effectAllowed =
        (eventInitDict as any)?.effectAllowed || 'uninitialized';
      this.dropEffect = 'none';
    }
  };
}

// Mock DataTransfer for jsdom
if (typeof DataTransfer === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).DataTransfer = class DataTransfer {
    dropEffect = 'none';
    effectAllowed = 'uninitialized';
    files: FileList;
    items: DataTransferItemList;
    types: readonly string[] = [];

    private _data: Map<string, string> = new Map();

    constructor() {
      this.files = [] as unknown as FileList;
      this.items = [] as unknown as DataTransferItemList;
    }

    getData(format: string): string {
      return this._data.get(format) || '';
    }

    setData(format: string, data: string): void {
      this._data.set(format, data);
      this.types = Array.from(this._data.keys());
    }

    clearData(format?: string): void {
      if (format) {
        this._data.delete(format);
      } else {
        this._data.clear();
      }
      this.types = Array.from(this._data.keys());
    }
  };
}
