import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequestGet } from '../functions/api/admin/stats.js';

const LIKES_SQL =
  'SELECT project_id, likes FROM project_likes ORDER BY likes DESC';
const COMMENTS_SQL =
  'SELECT id, post_id, author_name, content, created_at FROM blog_comments ORDER BY created_at DESC LIMIT 50';
const CONTACTS_SQL =
  'SELECT id, name, email, subject, message, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 50';

function createRequest(token = 'secret') {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return new Request('https://example.com/api/admin/stats', { headers });
}

function createDb({ results = {}, errors = {} } = {}) {
  return {
    prepare(query) {
      return {
        async all() {
          if (errors[query]) {
            throw errors[query];
          }

          return {
            results: results[query] || [],
          };
        },
      };
    },
  };
}

function createMemoryKv() {
  return {
    async list({ prefix }) {
      if (prefix === 'robot-memory:') {
        return { keys: [{ name: 'robot-memory:u_123' }] };
      }

      if (prefix === 'username:') {
        return { keys: [{ name: 'username:ada' }] };
      }

      return { keys: [] };
    },
    async get(key) {
      if (key === 'robot-memory:u_123') {
        return JSON.stringify([
          {
            key: 'location',
            value: 'Berlin',
            timestamp: '2026-03-12T10:00:00.000Z',
          },
        ]);
      }

      if (key === 'username:ada') {
        return 'u_123';
      }

      return null;
    },
  };
}

async function withMutedConsoleErrors(callback) {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    return await callback();
  } finally {
    console.error = originalConsoleError;
  }
}

test('admin stats rejects invalid bearer tokens', async () => {
  const response = await onRequestGet({
    request: createRequest('wrong'),
    env: {
      ADMIN_TOKEN: 'secret',
    },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: 'Unauthorized',
    code: 'unauthorized',
  });
});

test('admin stats reports missing admin token configuration', async () => {
  const response = await onRequestGet({
    request: createRequest('secret'),
    env: {},
  });

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: 'Admin configuration error: ADMIN_TOKEN is missing',
    code: 'admin_token_missing',
  });
});

test('admin stats returns partial data with warnings when tables are missing', async () => {
  const response = await withMutedConsoleErrors(() =>
    onRequestGet({
      request: createRequest('secret'),
      env: {
        ADMIN_TOKEN: 'secret',
        DB_LIKES: createDb({
          results: {
            [LIKES_SQL]: [{ project_id: 'robot', likes: 7 }],
          },
          errors: {
            [COMMENTS_SQL]: new Error('D1_ERROR: no such table: blog_comments'),
            [CONTACTS_SQL]: new Error(
              'D1_ERROR: no such table: contact_messages',
            ),
          },
        }),
        JULES_MEMORY_KV: createMemoryKv(),
      },
    }),
  );

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.deepEqual(payload.likes, [{ project_id: 'robot', likes: 7 }]);
  assert.deepEqual(payload.comments, []);
  assert.deepEqual(payload.contacts, []);
  assert.deepEqual(payload.nameMappings, [{ name: 'ada', userId: 'u_123' }]);
  assert.equal(payload.aiMemories.length, 1);
  assert.equal(payload.aiMemories[0].userId, 'u_123');
  assert.equal(payload.warnings.length, 2);
  assert.deepEqual(
    payload.warnings.map((warning) => warning.code),
    ['missing_table', 'missing_table'],
  );
});
