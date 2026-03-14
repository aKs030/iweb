import assert from 'node:assert/strict';
import test from 'node:test';

import { AIAgentService } from '../content/components/robot-companion/ai-agent-service.js';
import { __test__ as aiAgentTests } from '../functions/api/ai-agent.js';

test('resolveUserIdentity recovers an existing profile for "ich bin <name>"', async () => {
  const env = {
    JULES_MEMORY_KV: {
      async get(key) {
        return key === 'username:abdo' ? 'u_known_123' : '';
      },
    },
  };

  const request = new Request('https://example.com/api/ai-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await aiAgentTests.resolveUserIdentity(
    request,
    '',
    'ich bin abdo',
    env,
    {},
  );

  assert.equal(result.userId, 'u_known_123');
  assert.equal(result.wasAutoRecovered, true);
  assert.equal(result.recovery, null);
});

test('resolveUserIdentity ignores non-name phrases for "ich bin <zustand>"', async () => {
  const env = {
    JULES_MEMORY_KV: {
      async get() {
        return '';
      },
    },
  };

  const request = new Request('https://example.com/api/ai-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await aiAgentTests.resolveUserIdentity(
    request,
    '',
    'ich bin müde',
    env,
    {},
  );

  assert.equal(result.wasAutoRecovered, false);
  assert.equal(result.recovery, null);
  assert.match(result.userId, /^u_/);
});

test('listCloudflareMemories can load through server-side identity fallback', async () => {
  const calls = [];
  const service = new AIAgentService({
    fetchImpl: async (url, options) => {
      calls.push({
        url,
        headers: options.headers,
        body: JSON.parse(String(options.body || '{}')),
      });

      return new Response(
        JSON.stringify({
          success: true,
          userId: 'u_cookie_123',
          memories: [
            {
              key: 'name',
              value: 'Abdo',
              category: 'identity',
              priority: 100,
              timestamp: 1,
            },
          ],
          retentionDays: 180,
          profile: {
            userId: 'u_cookie_123',
            name: 'Abdo',
            status: 'identified',
            label: 'Profil: Abdo',
          },
          text: 'ok',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    },
  });

  const result = await service.listCloudflareMemories();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/ai-agent-user');
  assert.deepEqual(calls[0].body, { action: 'list' });
  assert.equal(result.success, true);
  assert.equal(result.profile.userId, 'u_cookie_123');
  assert.equal(result.memories[0].value, 'Abdo');
});
