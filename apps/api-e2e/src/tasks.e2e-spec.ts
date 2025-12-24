import { fetchApi } from './test-utils';

describe('Tasks API (e2e)', () => {
  describe('GET /tasks', () => {
    it('should require authentication', async () => {
      const response = await fetchApi('/tasks');

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('GET /tasks/:id', () => {
    it('should require authentication for single task', async () => {
      const response = await fetchApi('/tasks/some-id');

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('POST /tasks', () => {
    it('should require authentication for creating task', async () => {
      const response = await fetchApi('/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: 'test-agent-id',
          prompt: 'Test prompt',
        }),
      });

      expect([401, 403]).toContain(response.status);
    });
  });
});
