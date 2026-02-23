import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from './gallery-items.js';

test('gallery-items pagination', async (_t) => {
  const mockBucket = {
    async list({ cursor }) {
      if (!cursor) {
        return {
          objects: [
            {
              key: 'Gallery/img1.jpg',
              size: 100,
              uploaded: new Date('2023-01-01').toISOString(),
            },
            {
              key: 'Gallery/img2.jpg',
              size: 200,
              uploaded: new Date('2023-01-02').toISOString(),
            },
          ],
          truncated: true,
          cursor: 'cursor-1',
        };
      } else if (cursor === 'cursor-1') {
        return {
          objects: [
            {
              key: 'Gallery/img3.jpg',
              size: 300,
              uploaded: new Date('2023-01-03').toISOString(),
            },
          ],
          truncated: false,
        };
      }
      return { objects: [] };
    },
  };

  const context = {
    request: new Request('https://example.com/api/gallery-items'),
    env: {
      GALLERY_BUCKET: mockBucket,
    },
  };

  const response = await onRequest(context);
  const data = await response.json();

  assert.equal(response.status, 200);
  // Current implementation fails here because it only gets first page (2 items)
  assert.equal(
    data.items.length,
    3,
    'Should return all 3 items from paginated list',
  );

  // Verify sorting (newest first)
  assert.equal(data.items[0].id, 'Gallery/img3.jpg');
  assert.equal(data.items[1].id, 'Gallery/img2.jpg');
  assert.equal(data.items[2].id, 'Gallery/img1.jpg');
});
