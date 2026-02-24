#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ZONE_NAME = 'abdulkerimsesli.de';
const DEFAULT_DAYS = 8;
const MAX_DAYS = 8; // GraphQL adaptive dataset lookback on this plan
const DEFAULT_LIMIT_PER_DAY = 500;
const DEFAULT_STATUSES = [301, 404];
const GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const REST_ENDPOINT = 'https://api.cloudflare.com/client/v4';
const REPORT_DIR = path.resolve('reports/redirect-audit');
const REDIRECTS_PATH = path.resolve('_redirects');

function parseArgs(argv) {
  const args = {
    applyPrune: false,
    days: DEFAULT_DAYS,
    limitPerDay: DEFAULT_LIMIT_PER_DAY,
    statuses: [...DEFAULT_STATUSES],
    zoneName: process.env.CLOUDFLARE_ZONE_NAME || DEFAULT_ZONE_NAME,
    zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--apply-prune') {
      args.applyPrune = true;
      continue;
    }
    if (token === '--days') {
      args.days = Number.parseInt(argv[i + 1] || '', 10);
      i += 1;
      continue;
    }
    if (token === '--limit') {
      args.limitPerDay = Number.parseInt(argv[i + 1] || '', 10);
      i += 1;
      continue;
    }
    if (token === '--statuses') {
      args.statuses = String(argv[i + 1] || '')
        .split(',')
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter(Number.isFinite);
      i += 1;
      continue;
    }
    if (token === '--zone-name') {
      args.zoneName = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (token === '--zone-id') {
      args.zoneId = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
  }

  if (!Number.isFinite(args.days) || args.days <= 0) {
    args.days = DEFAULT_DAYS;
  }
  if (!Number.isFinite(args.limitPerDay) || args.limitPerDay <= 0) {
    args.limitPerDay = DEFAULT_LIMIT_PER_DAY;
  }
  if (!Array.isArray(args.statuses) || args.statuses.length === 0) {
    args.statuses = [...DEFAULT_STATUSES];
  }
  if (args.days > MAX_DAYS) {
    console.warn(
      `[audit] --days ${args.days} exceeds plan lookback; clamped to ${MAX_DAYS}.`,
    );
    args.days = MAX_DAYS;
  }

  return args;
}

function getAuthHeaders() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  const email = process.env.CLOUDFLARE_EMAIL;
  const key = process.env.CLOUDFLARE_API_KEY;
  if (email && key) {
    return {
      'X-Auth-Email': email,
      'X-Auth-Key': key,
      'Content-Type': 'application/json',
    };
  }

  throw new Error(
    'Missing Cloudflare auth. Set CLOUDFLARE_API_TOKEN or CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY.',
  );
}

async function resolveZoneId(zoneName, headers) {
  const url = `${REST_ENDPOINT}/zones?name=${encodeURIComponent(zoneName)}&status=active`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Zone lookup failed (${response.status})`);
  }

  const payload = await response.json();
  if (
    !payload?.success ||
    !Array.isArray(payload.result) ||
    !payload.result[0]
  ) {
    throw new Error(`Zone "${zoneName}" not found or not active.`);
  }

  return payload.result[0].id;
}

function formatIsoStartOfDayUtc(date) {
  return `${date.toISOString().slice(0, 10)}T00:00:00Z`;
}

function buildUtcDailyRanges(days) {
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const lookbackCutoff = new Date(
    now.getTime() - MAX_DAYS * 24 * 60 * 60 * 1000 + 60 * 1000,
  );

  const ranges = [];
  for (let i = days; i >= 1; i -= 1) {
    const fromDate = new Date(todayUtc);
    fromDate.setUTCDate(fromDate.getUTCDate() - i);

    const toDate = new Date(fromDate);
    toDate.setUTCDate(toDate.getUTCDate() + 1);

    // Keep each query strictly within Cloudflare's adaptive lookback window.
    if (toDate <= lookbackCutoff) {
      continue;
    }
    const clampedFrom = fromDate < lookbackCutoff ? lookbackCutoff : fromDate;

    ranges.push({
      from: clampedFrom.toISOString(),
      to: formatIsoStartOfDayUtc(toDate),
      label: fromDate.toISOString().slice(0, 10),
    });
  }

  return ranges;
}

const TOP_PATHS_QUERY = `query GetTopPaths($zoneTag: String!, $from: Time!, $to: Time!, $status: Int!, $limit: Int!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(
        limit: $limit
        orderBy: [count_DESC]
        filter: { datetime_geq: $from, datetime_lt: $to, edgeResponseStatus: $status }
      ) {
        count
        dimensions {
          clientRequestPath
          edgeResponseStatus
        }
      }
    }
  }
}`;

async function fetchTopPathsByStatusDay({
  headers,
  zoneId,
  from,
  to,
  status,
  limit,
}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: TOP_PATHS_QUERY,
      variables: {
        zoneTag: zoneId,
        from,
        to,
        status,
        limit,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL failed (${response.status})`);
  }

  const payload = await response.json();
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  if (errors.length > 0) {
    return { rows: [], errors };
  }

  const rows = payload?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups;
  return {
    rows: Array.isArray(rows) ? rows : [],
    errors: [],
  };
}

function aggregateRows(rowsByStatus) {
  const aggregated = {};

  for (const [status, rows] of Object.entries(rowsByStatus)) {
    const bucket = new Map();
    for (const row of rows) {
      const rawPath = row?.dimensions?.clientRequestPath;
      if (!rawPath) continue;
      const pathValue = String(rawPath).trim();
      if (!pathValue) continue;
      const count = Number(row?.count || 0);
      if (!Number.isFinite(count) || count <= 0) continue;
      bucket.set(pathValue, (bucket.get(pathValue) || 0) + count);
    }
    aggregated[status] = bucket;
  }

  return aggregated;
}

function mapToSortedArray(map) {
  return [...map.entries()]
    .map(([pathValue, count]) => ({
      path: pathValue,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

function escapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileCloudflarePathPattern(sourcePattern) {
  let regex = escapeRegex(sourcePattern);
  regex = regex.replace(/\\\*/g, '.*');
  regex = regex.replace(/:([A-Za-z0-9_]+)/g, '[^/]+');
  return new RegExp(`^${regex}$`);
}

function parseRedirectRules(content) {
  const lines = content.split('\n');
  const rules = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const match = trimmed.match(/^(\S+)\s+(\S+)\s+(\d{3})\b/);
    if (!match) return;

    rules.push({
      lineNumber: index + 1,
      source: match[1],
      target: match[2],
      status: Number.parseInt(match[3], 10),
      rawLine: line,
    });
  });

  return { rules, lines };
}

function computeRule301Hits(rules, top301) {
  return rules.map((rule) => {
    const matcher = compileCloudflarePathPattern(rule.source);
    let matchedCount = 0;
    let matchedPaths = 0;
    for (const entry of top301) {
      if (!matcher.test(entry.path)) continue;
      matchedCount += entry.count;
      matchedPaths += 1;
    }
    return {
      ...rule,
      matched301Count: matchedCount,
      matched301Paths: matchedPaths,
    };
  });
}

function isLegacyRuleSource(source) {
  return (
    source.startsWith('/pages/') ||
    source.startsWith('/content/') ||
    source.startsWith('/album')
  );
}

function isSafePruneLegacyPattern(source) {
  return (
    source.includes('/pages/design/pages/') ||
    source.includes('/pages/komponente/pages/') ||
    source.includes('/pages/pages/') ||
    source.includes('/pages/blog/pages/') ||
    source.includes('/content/webentwicklung/footer/') ||
    source.startsWith('/pages/features/') ||
    source.startsWith('/pages/card/') ||
    source.startsWith('/pages/komponente/menu') ||
    source.startsWith('/pages/komponente/footer') ||
    source.startsWith('/pages/index-game')
  );
}

function pickPruneCandidates(analyzedRules) {
  const zeroHitLegacy = analyzedRules.filter(
    (rule) =>
      rule.status === 301 &&
      isLegacyRuleSource(rule.source) &&
      rule.matched301Count === 0,
  );

  const safe = zeroHitLegacy.filter((rule) =>
    isSafePruneLegacyPattern(rule.source),
  );
  const review = zeroHitLegacy.filter(
    (rule) => !isSafePruneLegacyPattern(rule.source),
  );

  return { zeroHitLegacy, safe, review };
}

function trimTop(entries, limit = 50) {
  return entries.slice(0, limit);
}

function markdownTable(rows, headers) {
  if (!rows.length) return '_No data_';
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows
    .map((row) => `| ${headers.map((key) => row[key]).join(' | ')} |`)
    .join('\n');
  return `${head}\n${sep}\n${body}`;
}

async function writeReports({
  zoneId,
  zoneName,
  days,
  statuses,
  limitPerDay,
  sampledDays,
  topByStatus,
  analyzedRules,
  pruneCandidates,
  fetchWarnings,
}) {
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const generatedAt = new Date().toISOString();
  const jsonPayload = {
    generatedAt,
    zoneId,
    zoneName,
    days,
    statuses,
    limitPerDay,
    sampledDays,
    fetchWarnings,
    topByStatus,
    analyzedRules,
    pruneCandidates,
  };

  const jsonPath = path.join(REPORT_DIR, 'latest.json');
  await fs.writeFile(jsonPath, JSON.stringify(jsonPayload, null, 2), 'utf8');

  const top301Rows = trimTop(topByStatus['301'] || [], 30).map((entry) => ({
    path: entry.path,
    count: String(entry.count),
  }));
  const top404Rows = trimTop(topByStatus['404'] || [], 30).map((entry) => ({
    path: entry.path,
    count: String(entry.count),
  }));
  const safeRows = pruneCandidates.safe.map((rule) => ({
    line: String(rule.lineNumber),
    source: rule.source,
    target: rule.target,
  }));
  const reviewRows = pruneCandidates.review.map((rule) => ({
    line: String(rule.lineNumber),
    source: rule.source,
    target: rule.target,
  }));

  const markdown = [
    '# Cloudflare Redirect Audit',
    '',
    `- Generated: ${generatedAt}`,
    `- Zone: ${zoneName} (${zoneId})`,
    `- Days analyzed: ${days} (sampled ${sampledDays.length} daily windows)`,
    `- Statuses: ${statuses.join(', ')}`,
    `- Per-day limit: ${limitPerDay}`,
    '',
    '## Top 301 Paths',
    '',
    markdownTable(top301Rows, ['path', 'count']),
    '',
    '## Top 404 Paths',
    '',
    markdownTable(top404Rows, ['path', 'count']),
    '',
    '## Safe Prune Candidates (Auto)',
    '',
    markdownTable(safeRows, ['line', 'source', 'target']),
    '',
    '## Review Candidates (Manual)',
    '',
    markdownTable(reviewRows, ['line', 'source', 'target']),
    '',
  ];

  if (fetchWarnings.length > 0) {
    markdown.push('## Fetch Warnings', '');
    for (const warning of fetchWarnings) {
      markdown.push(`- ${warning}`);
    }
    markdown.push('');
  }

  const markdownPath = path.join(REPORT_DIR, 'latest.md');
  await fs.writeFile(markdownPath, markdown.join('\n'), 'utf8');

  const safeLinesPath = path.join(REPORT_DIR, 'safe-prune-lines.txt');
  await fs.writeFile(
    safeLinesPath,
    `${pruneCandidates.safe.map((rule) => rule.lineNumber).join('\n')}\n`,
    'utf8',
  );

  return { jsonPath, markdownPath, safeLinesPath };
}

async function applySafePrune(lines, safeCandidates) {
  if (!safeCandidates.length) return false;
  const removeLines = new Set(safeCandidates.map((rule) => rule.lineNumber));
  const nextLines = lines.filter((_line, index) => !removeLines.has(index + 1));
  await fs.writeFile(REDIRECTS_PATH, `${nextLines.join('\n')}\n`, 'utf8');
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const headers = getAuthHeaders();
  const zoneId = args.zoneId || (await resolveZoneId(args.zoneName, headers));
  const ranges = buildUtcDailyRanges(args.days);

  const rowsByStatus = Object.fromEntries(
    args.statuses.map((status) => [String(status), []]),
  );
  const fetchWarnings = [];

  for (const range of ranges) {
    for (const status of args.statuses) {
      const out = await fetchTopPathsByStatusDay({
        headers,
        zoneId,
        from: range.from,
        to: range.to,
        status,
        limit: args.limitPerDay,
      });

      if (out.errors?.length) {
        fetchWarnings.push(
          `${range.label} status ${status}: ${out.errors[0]?.message || 'unknown error'}`,
        );
        continue;
      }

      rowsByStatus[String(status)].push(...out.rows);
    }
  }

  const aggregated = aggregateRows(rowsByStatus);
  const topByStatus = Object.fromEntries(
    Object.entries(aggregated).map(([status, map]) => [
      status,
      mapToSortedArray(map),
    ]),
  );

  const redirectsRaw = await fs.readFile(REDIRECTS_PATH, 'utf8');
  const { rules, lines } = parseRedirectRules(redirectsRaw);
  const analyzedRules = computeRule301Hits(rules, topByStatus['301'] || []);
  const pruneCandidates = pickPruneCandidates(analyzedRules);

  const reportPaths = await writeReports({
    zoneId,
    zoneName: args.zoneName,
    days: args.days,
    statuses: args.statuses,
    limitPerDay: args.limitPerDay,
    sampledDays: ranges.map((r) => r.label),
    topByStatus,
    analyzedRules,
    pruneCandidates,
    fetchWarnings,
  });

  let pruned = false;
  if (args.applyPrune) {
    pruned = await applySafePrune(lines, pruneCandidates.safe);
  }

  console.log(`[audit] Zone: ${args.zoneName} (${zoneId})`);
  console.log(
    `[audit] Top 301 paths: ${(topByStatus['301'] || []).length}, top 404 paths: ${(topByStatus['404'] || []).length}`,
  );
  console.log(
    `[audit] Zero-hit legacy rules: ${pruneCandidates.zeroHitLegacy.length} (safe auto-prune: ${pruneCandidates.safe.length}, review: ${pruneCandidates.review.length})`,
  );
  if (args.applyPrune) {
    console.log(
      pruned
        ? `[audit] Applied safe prune to _redirects (${pruneCandidates.safe.length} rules removed).`
        : '[audit] No safe prune candidates to apply.',
    );
  }
  console.log(`[audit] JSON report: ${reportPaths.jsonPath}`);
  console.log(`[audit] Markdown report: ${reportPaths.markdownPath}`);
  console.log(`[audit] Safe prune lines: ${reportPaths.safeLinesPath}`);
}

main().catch((error) => {
  console.error(`[audit] Failed: ${error.message}`);
  process.exitCode = 1;
});
