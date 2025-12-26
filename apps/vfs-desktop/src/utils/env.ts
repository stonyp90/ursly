/**
 * Safely access import.meta.env (works in both Vite and Jest)
 * This is a workaround for Jest not supporting import.meta syntax
 */
// Type for import.meta mock
interface ImportMetaMock {
  env?: Record<string, string>;
}

export function getEnvVar(key: string): string | undefined {
  // Try to access via globalThis mock (set up in setupTests.ts)

  const globalImport = (globalThis as { import?: { meta?: ImportMetaMock } })
    .import;
  if (globalImport?.meta?.env?.[key]) {
    return globalImport.meta.env[key];
  }

  // Try direct access (works in Vite, fails silently in Jest)
  try {
    const meta =
      typeof (globalThis as { importMeta?: ImportMetaMock }).importMeta !==
      'undefined'
        ? (globalThis as { importMeta?: ImportMetaMock }).importMeta
        : undefined;
    if (meta?.env?.[key]) {
      return meta.env[key];
    }
  } catch {
    // import.meta not available (e.g., in Jest)
  }

  return undefined;
}

export function isProduction(): boolean {
  return getEnvVar('PROD') === 'true' || getEnvVar('MODE') === 'production';
}

export function isDevelopment(): boolean {
  return getEnvVar('DEV') === 'true' || getEnvVar('MODE') === 'development';
}
