import { createLogger } from '../../content/core/logger.js';
import { SHARED_ROBOT_TOOL_DEFINITIONS } from '../../content/components/robot-companion/modules/shared-tool-definitions.js';
import { storeMemory, recallMemories } from './_ai-agent-memory.js';

const log = createLogger('ai-agent-tools');

export const TOOL_DEFINITIONS = SHARED_ROBOT_TOOL_DEFINITIONS;

/** OpenAI-compatible tool format */
export const TOOLS = TOOL_DEFINITIONS.map((t) => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  },
}));

export async function executeServerTool(env, toolName, args, userId, config) {
  if (toolName === 'rememberUser') {
    const result = await storeMemory(
      env,
      userId,
      args.key || 'note',
      args.value || '',
      config,
    );
    return result.success
      ? `✅ Gemerkt: ${args.key} = "${args.value}"`
      : `Konnte nicht gespeichert werden (${result.error || 'Fehler'}).`;
  }

  if (toolName === 'recallMemory') {
    const memories = await recallMemories(
      env,
      userId,
      args.query || '',
      config,
    );
    if (!memories.length) return 'Keine Erinnerungen gefunden.';
    return (
      'Bekannte Infos:\n' +
      memories.map((m) => `- **${m.key}**: ${m.value}`).join('\n')
    );
  }

  return null; // Client-side tool
}

export function parseToolArguments(rawArguments, toolName) {
  if (!rawArguments) return {};
  if (typeof rawArguments === 'object' && !Array.isArray(rawArguments)) {
    return rawArguments;
  }
  if (typeof rawArguments !== 'string') return {};

  const trimmed = rawArguments.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    log.warn(
      `Failed to parse tool arguments for "${toolName || 'unknown'}":`,
      error?.message || error,
    );
    return {};
  }
}

export async function classifyToolCalls(env, toolCalls, userId, config) {
  const clientToolCalls = [];
  const serverToolResults = [];
  for (const tc of toolCalls) {
    const args = parseToolArguments(tc?.arguments, tc?.name);
    const serverResult = await executeServerTool(
      env,
      tc.name,
      args,
      userId,
      config,
    );
    if (serverResult !== null) {
      serverToolResults.push({ name: tc.name, result: serverResult });
    } else {
      clientToolCalls.push({ name: tc.name, arguments: args });
    }
  }
  return { clientToolCalls, serverToolResults };
}
