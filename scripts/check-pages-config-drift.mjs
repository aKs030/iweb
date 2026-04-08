import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadLocalEnv } from './load-local-env.mjs';

function parseArgs(argv) {
  const options = {};

  argv.forEach((arg) => {
    if (!arg.startsWith('--')) return;
    const [rawKey, ...rawValueParts] = arg.slice(2).split('=');
    const value = rawValueParts.length > 0 ? rawValueParts.join('=') : 'true';
    options[rawKey] = value;
  });

  return options;
}

function stripJsonComments(input) {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === '/' && next === '/') {
      while (index < input.length && input[index] !== '\n') index += 1;
      output += '\n';
      continue;
    }

    output += char;
  }

  return output.replace(/,\s*([}\]])/g, '$1');
}

async function readWranglerConfig(configPath) {
  const source = await fs.readFile(configPath, 'utf8');
  return JSON.parse(stripJsonComments(source));
}

async function resolveApiToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) {
    return process.env.CLOUDFLARE_API_TOKEN;
  }

  const wranglerConfigPath = path.join(
    os.homedir(),
    'Library/Preferences/.wrangler/config/default.toml',
  );
  const source = await fs.readFile(wranglerConfigPath, 'utf8');
  const match = source.match(/^oauth_token\s*=\s*"([^"]+)"/m);

  if (!match) {
    throw new Error(
      'No Cloudflare API token found. Set CLOUDFLARE_API_TOKEN or login with Wrangler.',
    );
  }

  return match[1];
}

function toKvMap(entries = []) {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.binding,
      {
        namespace_id: entry.id,
      },
    ]),
  );
}

function toD1Map(entries = []) {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.binding,
      {
        id: entry.database_id,
      },
    ]),
  );
}

function toR2Map(entries = []) {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.binding,
      {
        name: entry.bucket_name,
      },
    ]),
  );
}

function toVectorizeMap(entries = []) {
  return Object.fromEntries(
    entries.map((entry) => [
      entry.binding,
      {
        index_name: entry.index_name,
      },
    ]),
  );
}

function toAiMap(bindingConfig) {
  return bindingConfig?.binding
    ? {
        [bindingConfig.binding]: {},
      }
    : {};
}

function toPlainTextEnvMap(vars = {}) {
  return Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [
      key,
      { type: 'plain_text', value: String(value) },
    ]),
  );
}

function pickPlainTextValues(envVars = {}) {
  return Object.fromEntries(
    Object.entries(envVars)
      .filter(([, value]) => value?.type === 'plain_text')
      .map(([key, value]) => [key, value.value]),
  );
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function compareRecords(expected = {}, actual = {}) {
  const missing = Object.keys(expected)
    .filter((key) => !(key in actual))
    .sort();
  const extra = Object.keys(actual)
    .filter((key) => !(key in expected))
    .sort();
  const changed = Object.keys(expected)
    .filter(
      (key) =>
        key in actual &&
        stableStringify(expected[key]) !== stableStringify(actual[key]),
    )
    .sort()
    .map((key) => ({
      key,
      expected: expected[key],
      actual: actual[key],
    }));

  return { missing, extra, changed };
}

function buildExpectedBuildConfig(wranglerConfig, packageJson, options) {
  const destinationDir = String(wranglerConfig.pages_build_output_dir || '');
  const buildCommand =
    options['expected-build-command'] ||
    (!packageJson?.scripts?.build && destinationDir === '.' ? 'exit 0' : '');

  return {
    destination_dir: destinationDir,
    ...(buildCommand ? { build_command: buildCommand } : {}),
  };
}

function summarizeComparison(name, comparison) {
  return {
    name,
    ok:
      comparison.missing.length === 0 &&
      comparison.extra.length === 0 &&
      comparison.changed.length === 0,
    ...comparison,
  };
}

async function fetchPagesProject(accountId, projectName, token) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const json = await response.json();
  if (!response.ok || json.success !== true) {
    throw new Error(
      `Cloudflare API request failed: ${response.status} ${JSON.stringify(json.errors || json)}`,
    );
  }

  return json.result;
}

async function main() {
  await loadLocalEnv();

  const options = parseArgs(process.argv.slice(2));
  const projectName =
    options['project-name'] || process.env.CLOUDFLARE_PAGES_PROJECT;
  const accountId =
    options['account-id'] || process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const configPath = path.resolve(options.config || 'wrangler.jsonc');
  const packagePath = path.resolve(options.package || 'package.json');

  if (!projectName || !accountId) {
    throw new Error(
      'Usage: node scripts/check-pages-config-drift.mjs --project-name=<name> --account-id=<id>',
    );
  }

  const [wranglerConfig, packageJson, token] = await Promise.all([
    readWranglerConfig(configPath),
    fs.readFile(packagePath, 'utf8').then((source) => JSON.parse(source)),
    resolveApiToken(),
  ]);
  const liveProject = await fetchPagesProject(accountId, projectName, token);

  const expectedPreview = {
    env_vars: toPlainTextEnvMap(wranglerConfig.vars),
    kv_namespaces: toKvMap(wranglerConfig.kv_namespaces),
    d1_databases: toD1Map(wranglerConfig.d1_databases),
    r2_buckets: toR2Map(wranglerConfig.r2_buckets),
    vectorize_bindings: toVectorizeMap(wranglerConfig.vectorize),
    ai_bindings: toAiMap(wranglerConfig.ai),
    compatibility_date: wranglerConfig.compatibility_date,
    compatibility_flags: wranglerConfig.compatibility_flags || [],
  };

  const expectedProduction = {
    env_vars: toPlainTextEnvMap(wranglerConfig.env?.production?.vars),
    kv_namespaces: toKvMap(wranglerConfig.env?.production?.kv_namespaces),
    d1_databases: toD1Map(wranglerConfig.env?.production?.d1_databases),
    r2_buckets: toR2Map(wranglerConfig.env?.production?.r2_buckets),
    vectorize_bindings: toVectorizeMap(
      wranglerConfig.env?.production?.vectorize,
    ),
    ai_bindings: toAiMap(wranglerConfig.env?.production?.ai),
    compatibility_date: wranglerConfig.compatibility_date,
    compatibility_flags: wranglerConfig.compatibility_flags || [],
  };

  const previewConfig = liveProject.deployment_configs?.preview || {};
  const productionConfig = liveProject.deployment_configs?.production || {};
  const expectedBuildConfig = buildExpectedBuildConfig(
    wranglerConfig,
    packageJson,
    options,
  );
  const liveBuildConfig = {
    destination_dir: liveProject.build_config?.destination_dir || '',
    build_command: liveProject.build_config?.build_command || '',
  };

  const sections = [
    summarizeComparison(
      'preview.env_vars',
      compareRecords(
        wranglerConfig.vars || {},
        pickPlainTextValues(previewConfig.env_vars),
      ),
    ),
    summarizeComparison(
      'production.env_vars',
      compareRecords(
        wranglerConfig.env?.production?.vars || {},
        pickPlainTextValues(productionConfig.env_vars),
      ),
    ),
    summarizeComparison(
      'preview.kv_namespaces',
      compareRecords(
        expectedPreview.kv_namespaces,
        previewConfig.kv_namespaces || {},
      ),
    ),
    summarizeComparison(
      'production.kv_namespaces',
      compareRecords(
        expectedProduction.kv_namespaces,
        productionConfig.kv_namespaces || {},
      ),
    ),
    summarizeComparison(
      'preview.d1_databases',
      compareRecords(
        expectedPreview.d1_databases,
        previewConfig.d1_databases || {},
      ),
    ),
    summarizeComparison(
      'production.d1_databases',
      compareRecords(
        expectedProduction.d1_databases,
        productionConfig.d1_databases || {},
      ),
    ),
    summarizeComparison(
      'preview.r2_buckets',
      compareRecords(
        expectedPreview.r2_buckets,
        previewConfig.r2_buckets || {},
      ),
    ),
    summarizeComparison(
      'production.r2_buckets',
      compareRecords(
        expectedProduction.r2_buckets,
        productionConfig.r2_buckets || {},
      ),
    ),
    summarizeComparison(
      'preview.vectorize_bindings',
      compareRecords(
        expectedPreview.vectorize_bindings,
        previewConfig.vectorize_bindings || {},
      ),
    ),
    summarizeComparison(
      'production.vectorize_bindings',
      compareRecords(
        expectedProduction.vectorize_bindings,
        productionConfig.vectorize_bindings || {},
      ),
    ),
    summarizeComparison(
      'preview.ai_bindings',
      compareRecords(
        expectedPreview.ai_bindings,
        previewConfig.ai_bindings || {},
      ),
    ),
    summarizeComparison(
      'production.ai_bindings',
      compareRecords(
        expectedProduction.ai_bindings,
        productionConfig.ai_bindings || {},
      ),
    ),
    summarizeComparison(
      'preview.compatibility_flags',
      compareRecords(
        { compatibility_flags: expectedPreview.compatibility_flags },
        { compatibility_flags: previewConfig.compatibility_flags || [] },
      ),
    ),
    summarizeComparison(
      'production.compatibility_flags',
      compareRecords(
        { compatibility_flags: expectedProduction.compatibility_flags },
        { compatibility_flags: productionConfig.compatibility_flags || [] },
      ),
    ),
    summarizeComparison(
      'preview.compatibility_date',
      compareRecords(
        { compatibility_date: expectedPreview.compatibility_date },
        { compatibility_date: previewConfig.compatibility_date || '' },
      ),
    ),
    summarizeComparison(
      'production.compatibility_date',
      compareRecords(
        { compatibility_date: expectedProduction.compatibility_date },
        { compatibility_date: productionConfig.compatibility_date || '' },
      ),
    ),
    summarizeComparison(
      'build_config',
      compareRecords(expectedBuildConfig, liveBuildConfig),
    ),
  ];

  const drift = sections.filter((section) => !section.ok);
  const result = {
    project: projectName,
    accountId,
    checkedAt: new Date().toISOString(),
    ok: drift.length === 0,
    sections,
  };

  console.log(JSON.stringify(result, null, 2));

  if (drift.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
