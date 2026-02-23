import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCorsHeaders } from './_cors.js';

test('getCorsHeaders security check', async (t) => {
  const env = {
    ALLOWED_ORIGINS:
      'https://abdulkerimsesli.de,https://www.abdulkerimsesli.de',
  };

  const allowedOrigins = [
    'https://abdulkerimsesli.de',
    'https://www.abdulkerimsesli.de',
    'https://1web.pages.dev',
    'https://preview-branch.1web.pages.dev',
    'http://localhost:8788',
    'http://127.0.0.1:8788',
  ];

  const deniedOrigins = [
    'https://evil.com',
    'https://evil-site.pages.dev',
    'https://evil.com/localhost',
    'http://evil.com/127.0.0.1',
    'https://not-1web.pages.dev',
  ];

  await t.test('allows valid origins', () => {
    for (const origin of allowedOrigins) {
      const req = new Request('https://api.example.com', {
        headers: { Origin: origin },
      });
      const headers = getCorsHeaders(req, env);
      assert.equal(
        headers['Access-Control-Allow-Origin'],
        origin,
        `Origin ${origin} should be allowed`,
      );
    }
  });

  await t.test('denies invalid origins', () => {
    for (const origin of deniedOrigins) {
      const req = new Request('https://api.example.com', {
        headers: { Origin: origin },
      });
      const headers = getCorsHeaders(req, env);
      assert.equal(
        headers['Access-Control-Allow-Origin'],
        undefined,
        `Origin ${origin} should be denied`,
      );
    }
  });
});
