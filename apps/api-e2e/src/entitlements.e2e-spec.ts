import { fetchApi } from './test-utils';

describe('Entitlements API (e2e)', () => {
  describe('GET /entitlements/permissions', () => {
    it('should require authentication', async () => {
      const response = await fetchApi('/entitlements/permissions');

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('GET /entitlements/groups', () => {
    it('should require authentication', async () => {
      const response = await fetchApi('/entitlements/groups');

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('GET /entitlements/users/me', () => {
    it('should require authentication', async () => {
      const response = await fetchApi('/entitlements/users/me');

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('POST /entitlements/authorize', () => {
    it('should require authentication', async () => {
      const response = await fetchApi('/entitlements/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          permissions: ['agents:read'],
        }),
      });

      expect([401, 403]).toContain(response.status);
    });
  });
});
