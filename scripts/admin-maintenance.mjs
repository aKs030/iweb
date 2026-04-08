import { loadLocalEnv } from './load-local-env.mjs';
import {
  fetchJson,
  getFlagValue,
  parseInteger,
  resolveUrlValue,
} from './script-utils.mjs';

const argv = process.argv.slice(2);

async function main() {
  await loadLocalEnv();

  const siteUrl = resolveUrlValue({
    argv,
    envKeys: ['PRODUCTION_SITE_URL'],
    defaultValue: 'https://www.abdulkerimsesli.de',
  });
  const adminToken = String(
    getFlagValue('--token', argv) || process.env.ADMIN_TOKEN || '',
  ).trim();
  const limit = parseInteger(getFlagValue('--limit', argv), 100, {
    min: 1,
    max: 500,
  });

  if (!adminToken) {
    throw new Error(
      'ADMIN_TOKEN fehlt fuer admin-maintenance (.dev.vars/.env.local/.env geprueft).',
    );
  }

  const endpoint = new URL('/api/admin/users', siteUrl).toString();
  const { response, payload } = await fetchJson(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      action: 'purge-expired-archives',
      limit,
    }),
  });
  if (!response.ok || payload?.success === false) {
    throw new Error(
      payload?.text ||
        payload?.error ||
        `admin-maintenance failed with status ${response.status}`,
    );
  }

  const count = Number(payload?.count) || 0;
  const userIds = Array.isArray(payload?.userIds) ? payload.userIds : [];
  console.log(
    JSON.stringify(
      {
        ok: true,
        url: endpoint,
        count,
        userIds,
        text: payload?.text || '',
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    `[admin-maintenance] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
