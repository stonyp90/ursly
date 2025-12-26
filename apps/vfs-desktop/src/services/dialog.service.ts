/**
 * Dialog Service - Native and themed dialog support
 * Uses Tauri's native dialog when available, falls back to custom themed modals
 */

// Check if Tauri is available
const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export type DialogType = 'info' | 'warning' | 'error';

export interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  okLabel?: string;
  cancelLabel?: string;
}

export interface ConfirmOptions extends DialogOptions {
  cancelLabel?: string;
}

/**
 * Show a message dialog (native if available)
 */
export async function showMessage(options: DialogOptions): Promise<void> {
  if (isTauri()) {
    try {
      // Use Tauri's native dialog plugin
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message(options.message, {
        title: options.title || getDefaultTitle(options.type),
        kind: mapDialogType(options.type),
        okLabel: options.okLabel,
      });
      return;
    } catch {
      // Fallback to custom dialog if Tauri dialog fails
    }
  }

  // Fallback: dispatch event for custom dialog
  window.dispatchEvent(
    new CustomEvent('ursly:dialog', {
      detail: { ...options, mode: 'message' },
    }),
  );
}

/**
 * Show an error dialog
 */
export async function showError(
  message: string,
  title?: string,
): Promise<void> {
  return showMessage({
    title: title || 'Error',
    message,
    type: 'error',
  });
}

/**
 * Show a warning dialog
 */
export async function showWarning(
  message: string,
  title?: string,
): Promise<void> {
  return showMessage({
    title: title || 'Warning',
    message,
    type: 'warning',
  });
}

/**
 * Show an info dialog
 */
export async function showInfo(message: string, title?: string): Promise<void> {
  return showMessage({
    title: title || 'Information',
    message,
    type: 'info',
  });
}

/**
 * Show a confirmation dialog
 */
export async function showConfirm(options: ConfirmOptions): Promise<boolean> {
  if (isTauri()) {
    try {
      const { confirm } = await import('@tauri-apps/plugin-dialog');
      return await confirm(options.message, {
        title: options.title || 'Confirm',
        kind: mapDialogType(options.type),
        okLabel: options.okLabel || 'OK',
        cancelLabel: options.cancelLabel || 'Cancel',
      });
    } catch {
      // Fallback to custom dialog if Tauri dialog fails
    }
  }

  // Fallback: use custom dialog with promise
  return new Promise((resolve) => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ confirmed: boolean }>;
      window.removeEventListener('ursly:dialog-response', handler);
      resolve(customEvent.detail.confirmed);
    };
    window.addEventListener('ursly:dialog-response', handler);

    window.dispatchEvent(
      new CustomEvent('ursly:dialog', {
        detail: { ...options, mode: 'confirm' },
      }),
    );
  });
}

/**
 * Show a file open dialog
 */
export async function showOpenDialog(options?: {
  title?: string;
  directory?: boolean;
  multiple?: boolean;
  filters?: { name: string; extensions: string[] }[];
}): Promise<string[] | null> {
  if (isTauri()) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        title: options?.title,
        directory: options?.directory,
        multiple: options?.multiple,
        filters: options?.filters,
      });

      if (result === null) return null;
      return Array.isArray(result) ? result : [result];
    } catch (err) {
      return null;
    }
  }

  // Fallback: use browser file input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = options?.multiple ?? false;
    if (options?.directory) {
      input.webkitdirectory = true;
    }

    input.onchange = () => {
      const files = Array.from(input.files || []).map((f) => f.name);
      resolve(files.length > 0 ? files : null);
    };

    input.click();
  });
}

/**
 * Show a save dialog
 */
export async function showSaveDialog(options?: {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}): Promise<string | null> {
  if (isTauri()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      return await save({
        title: options?.title,
        defaultPath: options?.defaultPath,
        filters: options?.filters,
      });
    } catch (err) {
      return null;
    }
  }

  // Fallback: prompt for filename
  const filename = prompt(
    'Enter filename:',
    options?.defaultPath || 'untitled',
  );
  return filename;
}

// Helper functions
function getDefaultTitle(type?: DialogType): string {
  switch (type) {
    case 'error':
      return 'Error';
    case 'warning':
      return 'Warning';
    case 'info':
      return 'Information';
    default:
      return 'Message';
  }
}

function mapDialogType(type?: DialogType): 'info' | 'warning' | 'error' {
  return type || 'info';
}

// Export default object for convenience
export const DialogService = {
  message: showMessage,
  error: showError,
  warning: showWarning,
  info: showInfo,
  confirm: showConfirm,
  open: showOpenDialog,
  save: showSaveDialog,
};

export default DialogService;
