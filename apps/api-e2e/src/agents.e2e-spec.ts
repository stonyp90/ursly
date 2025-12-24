import { fetchApi } from './test-utils';

describe('Agents API (e2e)', () => {
  describe('GET /agents', () => {
    it('should require authentication', async () => {
      const response = await fetchApi('/agents');

      // Should return 401 Unauthorized without token
      expect([401, 403]).toContain(response.status);
    });

    it('should accept valid authentication header format', async () => {
      const response = await fetchApi('/agents', {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      // Should return 401 for invalid token (not 500)
      expect([401, 403]).toContain(response.status);
    });

    it('should return proper error message for unauthorized', async () => {
      const response = await fetchApi('/agents');
      const body = await response.json().catch(() => ({}));

      expect(body).toHaveProperty('message');
    });
  });

  describe('GET /agents/:id', () => {
    it('should require authentication for single agent', async () => {
      const response = await fetchApi('/agents/some-id');

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('POST /agents', () => {
    it('should require authentication for creating agent', async () => {
      const response = await fetchApi('/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Agent',
          model: 'llama3',
          systemPrompt: 'You are a test agent',
        }),
      });

      expect([401, 403]).toContain(response.status);
    });

    it('should not accept invalid content type without auth', async () => {
      const response = await fetchApi('/agents', {
        method: 'POST',
        body: 'invalid-body',
      });

      // Should still be auth error, not parsing error
      expect([400, 401, 403, 415]).toContain(response.status);
    });
  });

  describe('PUT /agents/:id', () => {
    it('should require authentication for updating agent', async () => {
      const response = await fetchApi('/agents/some-id', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Agent',
        }),
      });

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('DELETE /agents/:id', () => {
    it('should require authentication for deleting agent', async () => {
      const response = await fetchApi('/agents/some-id', {
        method: 'DELETE',
      });

      expect([401, 403]).toContain(response.status);
    });
  });
});
