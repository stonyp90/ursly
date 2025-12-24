import { fetchApi } from './test-utils';

describe('OpenAPI Documentation (e2e)', () => {
  describe('GET /api/docs', () => {
    it('should serve OpenAPI documentation', async () => {
      const response = await fetchApi('/api/docs');

      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toContain('text/html');
    });
  });

  describe('GET /api/docs-json', () => {
    it('should serve OpenAPI JSON spec', async () => {
      const response = await fetchApi('/api/docs-json');

      expect(response.ok).toBe(true);

      const spec = await response.json();
      expect(spec).toHaveProperty('openapi');
      expect(spec).toHaveProperty('info');
      expect(spec).toHaveProperty('paths');
    });

    it('should have valid OpenAPI version', async () => {
      const response = await fetchApi('/api/docs-json');
      const spec = await response.json();

      expect(spec.openapi).toMatch(/^3\.\d+\.\d+$/);
    });

    it('should include API info', async () => {
      const response = await fetchApi('/api/docs-json');
      const spec = await response.json();

      expect(spec.info).toHaveProperty('title');
      expect(spec.info).toHaveProperty('version');
    });

    it('should document the agents endpoint', async () => {
      const response = await fetchApi('/api/docs-json');
      const spec = await response.json();

      expect(spec.paths).toHaveProperty('/agents');
    });

    it('should document the health endpoint', async () => {
      const response = await fetchApi('/api/docs-json');
      const spec = await response.json();

      expect(spec.paths).toHaveProperty('/health');
    });
  });
});
