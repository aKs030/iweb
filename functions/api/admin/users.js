import { normalizeUserId } from '../_user-identity.js';
import { getMemoryKV } from '../ai-agent-user.js';
import {
  authorizeAdmin,
  getErrorMessage,
  jsonResponse,
} from './_admin-utils.js';
import { normalizeAction } from './_admin-user-operations.js';
import { handleAdminUsersAction } from './_admin-user-request-handlers.js';

export async function onRequestPost(context) {
  const auth = await authorizeAdmin(context.request, context.env);
  if (!auth.ok) return auth.response;

  try {
    const body = await context.request.json().catch(() => ({}));
    const kv = getMemoryKV(context.env);

    if (!kv) {
      return jsonResponse(
        {
          success: false,
          text: 'Cloudflare KV fuer Memory ist nicht verfuegbar.',
        },
        503,
      );
    }

    return handleAdminUsersAction(normalizeAction(body?.action), {
      body,
      env: context.env,
      auth,
      kv,
      userId: normalizeUserId(body?.userId),
      waitUntil: context.waitUntil,
    });
  } catch (error) {
    console.error('[admin-users] request failed:', error);
    return jsonResponse(
      {
        success: false,
        error: getErrorMessage(error) || 'admin_user_action_failed',
      },
      500,
    );
  }
}
