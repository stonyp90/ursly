import '@testing-library/jest-dom';

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

// Mock DragEvent for jsdom (not available by default)
if (typeof DragEvent === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).DragEvent = class DragEvent extends Event {
    dataTransfer: DataTransfer | null;
    effectAllowed: string;
    dropEffect: string;

    constructor(type: string, eventInitDict?: DragEventInit) {
      super(type, eventInitDict);
      this.dataTransfer = eventInitDict?.dataTransfer || null;
      this.effectAllowed = eventInitDict?.effectAllowed || 'uninitialized';
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
