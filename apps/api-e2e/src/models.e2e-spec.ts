import { fetchApi } from './test-utils';

describe('Models API (e2e)', () => {
  describe('GET /models', () => {
    it('should require authentication', async () => {
      const response = await fetchApi('/models');

      expect([401, 403]).toContain(response.status);
    });

    it('should return proper error structure', async () => {
      const response = await fetchApi('/models');
      const body = await response.json().catch(() => ({}));

      expect(body).toHaveProperty('message');
    });
  });

  describe('POST /models/pull', () => {
    it('should require authentication for pulling models', async () => {
      const response = await fetchApi('/models/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'llama3' }),
      });

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('DELETE /models/:name', () => {
    it('should require authentication for deleting models', async () => {
      const response = await fetchApi('/models/llama3', {
        method: 'DELETE',
      });

      expect([401, 403]).toContain(response.status);
    });
  });
});
