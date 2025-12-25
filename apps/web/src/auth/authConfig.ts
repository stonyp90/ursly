import { WebStorageStateStore } from 'oidc-client-ts';
import { env } from '../config';

/**
 * Get the appropriate base URL for auth redirects
 * Uses VITE_REDIRECT_URL if set, otherwise falls back to window.location.origin
 *
 * For Tauri apps, the Keycloak client must have these redirect URIs registered:
 * - tauri://localhost/* (macOS/Linux production)
 * - https://tauri.localhost/* (Windows production)
 * - http://localhost:1420/* (development)
 */
const getRedirectBase = (): string => {
  // Allow override via environment variable
  const envRedirectUrl = import.meta.env.VITE_REDIRECT_URL;
  if (envRedirectUrl) {
    return envRedirectUrl;
  }
  return window.location.origin;
};

const redirectBase = getRedirectBase();

export const oidcConfig = {
  authority: `${env.keycloak.url}/realms/${env.keycloak.realm}`,
  client_id: env.keycloak.clientId,
  redirect_uri: `${redirectBase}/callback`,
  post_logout_redirect_uri: redirectBase,
  response_type: 'code',
  scope: 'openid profile email',
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  // Refresh token settings
  silent_redirect_uri: `${redirectBase}/silent-renew.html`,
  revokeTokensOnSignout: true,
};
