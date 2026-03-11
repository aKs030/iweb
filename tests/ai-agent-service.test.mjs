import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AIAgentService,
  __test__,
} from '../content/components/robot-companion/ai-agent-service.js';

test('createToolCallKey normalizes argument order and distinguishes payloads', () => {
  const first = __test__.createToolCallKey({
    name: 'openExternalLink',
    arguments: { newTab: true, url: 'https://example.com' },
  });
  const same = __test__.createToolCallKey({
    name: 'openExternalLink',
    arguments: { url: 'https://example.com', newTab: true },
  });
  const different = __test__.createToolCallKey({
    name: 'openExternalLink',
    arguments: { url: 'https://example.org', newTab: true },
  });

  assert.equal(first, same);
  assert.notEqual(first, different);
});

test('parseSSEStream flushes trailing final message at EOF', async () => {
  const encoder = new TextEncoder();
  const seenTokens = [];
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('event: token\ndata: {"text":"Hal"}\n\n'),
        );
        controller.enqueue(
          encoder.encode('event: message\ndata: {"text":"Hallo"}'),
        );
        controller.close();
      },
    }),
    {
      headers: {
        'content-type': 'text/event-stream',
      },
    },
  );

  const finalMessage = await __test__.parseSSEStream(response, {
    onToken(text) {
      seenTokens.push(text);
    },
  });

  assert.deepEqual(seenTokens, ['Hal']);
  assert.equal(finalMessage?.text, 'Hallo');
});

test('AIAgentService cancels active requests without user-facing abort noise', async () => {
  let seenSignal = null;
  const service = new AIAgentService({
    requestTimeoutMs: 1000,
    fetchImpl: async (_url, options = {}) =>
      await new Promise((_resolve, reject) => {
        seenSignal = options.signal;
        options.signal.addEventListener(
          'abort',
          () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true },
        );
      }),
  });
  const streamed = [];

  const pending = service.generateResponse('Hallo Jules', (text) => {
    streamed.push(text);
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(service.cancelActiveRequest('destroyed'), true);

  const result = await pending;

  assert.equal(result.aborted, true);
  assert.equal(result.text, '');
  assert.deepEqual(streamed, []);
  assert.equal(seenSignal?.aborted, true);
  assert.equal(service._activeController, null);
});
