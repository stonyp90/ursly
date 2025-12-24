/**
 * Tauri detection and integration utilities
 * These functions only work when running inside Tauri desktop app
 * All functions are safe to call in a browser environment - they will gracefully fail
 */

// Check if running in Tauri desktop app (v2 uses __TAURI_INTERNALS__)
export function isTauri(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    // Tauri v2 uses __TAURI_INTERNALS__, v1 uses __TAURI__
    return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  } catch {
    return false;
  }
}

// Dynamically import and invoke Tauri commands
// Safe to call in browser - will throw a clear error
export async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error('Not running in Tauri desktop app');
  }
  
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  } catch (err) {
    throw new Error(`Failed to invoke Tauri command "${cmd}": ${err}`);
  }
}

// Listen to Tauri events
// Safe to call in browser - returns a no-op cleanup function
export async function listenTauri<T>(
  event: string,
  callback: (payload: T) => void
): Promise<() => void> {
  if (!isTauri()) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {}; // No-op cleanup in browser
  }
  
  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<T>(event, (e) => callback(e.payload));
    return unlisten;
  } catch (err) {
    console.warn(`Failed to listen to Tauri event "${event}":`, err);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {}; // Return no-op on error
  }
}

