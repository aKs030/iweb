export const sseEvent = (event, data) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export function buildAgentMessagePayload(
  text,
  clientToolCalls,
  serverToolResults,
  ctx,
  config,
) {
  return {
    text,
    toolCalls: clientToolCalls,
    model: config.chatModel,
    hasMemory: !!ctx.memoryContext,
    hasImage: !!ctx.imageAnalysis,
    ...(serverToolResults.length && {
      toolResults: serverToolResults.map((r) => r.name),
    }),
  };
}

export function hasMeaningfulAgentText(text, minLength = 4) {
  return (
    String(text || '')
      .replace(/\s+/g, ' ')
      .trim().length >= minLength
  );
}

export async function streamToSSE(stream, write) {
  if (!(stream instanceof ReadableStream)) {
    if (stream?.response) {
      await write('token', { text: stream.response });
      return stream.response;
    }
    return '';
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let lineBuffer = '';
  let eventDataLines = [];

  const flushEvent = async () => {
    if (eventDataLines.length === 0) return;

    const payload = eventDataLines.join('\n').trim();
    eventDataLines = [];
    if (!payload || payload === '[DONE]') return;

    let delta = '';
    try {
      const parsed = JSON.parse(payload);
      if (typeof parsed?.response === 'string') {
        delta = parsed.response;
      } else if (typeof parsed?.text === 'string') {
        delta = parsed.text;
      }
    } catch {
      delta = payload;
    }

    if (!delta) return;
    text += delta;
    await write('token', { text: delta });
  };

  const consumeChunk = async (chunk, isFinal = false) => {
    if (chunk) lineBuffer += chunk;

    let newlineIndex = lineBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const rawLine = lineBuffer.slice(0, newlineIndex);
      lineBuffer = lineBuffer.slice(newlineIndex + 1);
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

      if (!line) {
        await flushEvent();
      } else if (line.startsWith('data:')) {
        eventDataLines.push(line.slice(5).trimStart());
      }

      newlineIndex = lineBuffer.indexOf('\n');
    }

    if (!isFinal) return;

    const tail = lineBuffer.endsWith('\r')
      ? lineBuffer.slice(0, -1)
      : lineBuffer;
    if (tail && tail.startsWith('data:')) {
      eventDataLines.push(tail.slice(5).trimStart());
    }
    lineBuffer = '';
    await flushEvent();
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await consumeChunk(decoder.decode(value, { stream: true }));
    }
    await consumeChunk(decoder.decode(), true);
  } finally {
    reader.releaseLock();
  }

  return text;
}
