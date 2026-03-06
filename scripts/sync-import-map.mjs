import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import prettier from 'prettier';

const cwd = process.cwd();
const checkOnly = process.argv.includes('--check');
const packageJsonPath = path.join(cwd, 'package.json');
const templatePath = path.join(cwd, 'content/templates/global-head.html');
const generatedConfigPath = path.join(
  cwd,
  'content/config/import-map.generated.js',
);

const templateStartMarker = '<!-- BEGIN GENERATED IMPORT MAP -->';
const templateEndMarker = '<!-- END GENERATED IMPORT MAP -->';

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

const getPinnedVersion = (name, fallback = '') => {
  const raw =
    packageJson.dependencies?.[name] || packageJson.devDependencies?.[name];
  const match = String(raw || fallback).match(/\d+\.\d+\.\d+(?:[-+][\w.-]+)?/);
  if (!match) {
    throw new Error(`Missing version for ${name}`);
  }
  return match[0];
};

const versions = Object.freeze({
  react: getPinnedVersion('react'),
  'react-dom': getPinnedVersion('react-dom'),
  'lucide-react': getPinnedVersion('lucide-react'),
  three: getPinnedVersion('three'),
  htm: getPinnedVersion('htm'),
  'idb-keyval': '6.2.1',
});

const importMap = Object.freeze({
  imports: Object.freeze({
    react: `https://esm.sh/react@${versions.react}`,
    'react-dom': `https://esm.sh/react-dom@${versions['react-dom']}`,
    'react-dom/client': `https://esm.sh/react-dom@${versions['react-dom']}/client`,
    'lucide-react': `https://esm.sh/lucide-react@${versions['lucide-react']}`,
    three: `https://cdn.jsdelivr.net/npm/three@${versions.three}/build/three.module.min.js`,
    'three/addons/': `https://cdn.jsdelivr.net/npm/three@${versions.three}/examples/jsm/`,
    htm: `https://esm.sh/htm@${versions.htm}`,
    'idb-keyval': `https://esm.sh/idb-keyval@${versions['idb-keyval']}`,
    '#core/': '/content/core/',
    '#components/': '/content/components/',
    '#config/': '/content/config/',
    '#pages/': '/pages/',
  }),
  scopes: Object.freeze({
    'https://esm.sh/': Object.freeze({
      react: `https://esm.sh/react@${versions.react}`,
    }),
  }),
});

const rawGeneratedConfigSource = `export const IMPORT_MAP_VERSIONS = Object.freeze(${JSON.stringify(
  versions,
  null,
  2,
)});

export const IMPORT_MAP = Object.freeze({
  imports: Object.freeze(${JSON.stringify(importMap.imports, null, 2)}),
  scopes: Object.freeze({
    'https://esm.sh/': Object.freeze(${JSON.stringify(
      importMap.scopes['https://esm.sh/'],
      null,
      2,
    )}),
  }),
});

export const SEARCH_PRELOAD_IMPORT_KEYS = Object.freeze([
  'htm',
  'react-dom',
  'react-dom/client',
]);

export const SEARCH_PRELOAD_URLS = Object.freeze(
  SEARCH_PRELOAD_IMPORT_KEYS.map((key) => IMPORT_MAP.imports[key]).filter(
    Boolean,
  ),
);
`;

const generatedTemplateBlock = `${templateStartMarker}
<script type="importmap">
${JSON.stringify(importMap, null, 2)}
</script>
${templateEndMarker}`;

const currentTemplate = await readFile(templatePath, 'utf8');

if (
  !currentTemplate.includes(templateStartMarker) ||
  !currentTemplate.includes(templateEndMarker)
) {
  throw new Error('Import map markers missing in global-head.html');
}

const nextTemplate = currentTemplate.replace(
  new RegExp(`${templateStartMarker}[\\s\\S]*?${templateEndMarker}`, 'm'),
  generatedTemplateBlock,
);

const currentGeneratedConfig = await readFile(
  generatedConfigPath,
  'utf8',
).catch(() => '');
const generatedConfigFormatOptions =
  (await prettier.resolveConfig(generatedConfigPath)) || {};
const templateFormatOptions =
  (await prettier.resolveConfig(templatePath)) || {};
const generatedConfigSource = await prettier.format(rawGeneratedConfigSource, {
  ...generatedConfigFormatOptions,
  filepath: generatedConfigPath,
});
const formattedTemplate = await prettier.format(nextTemplate, {
  ...templateFormatOptions,
  filepath: templatePath,
});

const hasTemplateDiff = formattedTemplate !== currentTemplate;
const hasGeneratedDiff = generatedConfigSource !== currentGeneratedConfig;

if (checkOnly) {
  if (hasTemplateDiff || hasGeneratedDiff) {
    process.stderr.write(
      'Import map artifacts are out of sync. Run `npm run importmap:sync`.\n',
    );
    process.exit(1);
  }

  process.exit(0);
}

if (hasTemplateDiff) {
  await writeFile(templatePath, formattedTemplate, 'utf8');
}

if (hasGeneratedDiff) {
  await writeFile(generatedConfigPath, generatedConfigSource, 'utf8');
}
