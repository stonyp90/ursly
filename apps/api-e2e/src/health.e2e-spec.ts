import { fetchApi } from './test-utils';

describe('Health API (e2e)', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await fetchApi('/health');

      expect(response.ok).toBe(true);

      const body = await response.json();
      expect(body).toHaveProperty('status', 'ok');
    });

    it('should respond within acceptable time', async () => {
      const startTime = Date.now();
      await fetchApi('/health');
      const responseTime = Date.now() - startTime;

      // Health check should respond within 1 second
      expect(responseTime).toBeLessThan(1000);
    });

    it('should return JSON content type', async () => {
      const response = await fetchApi('/health');
      const contentType = response.headers.get('content-type');

      expect(contentType).toContain('application/json');
    });
  });
});
