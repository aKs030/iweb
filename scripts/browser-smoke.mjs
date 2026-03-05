#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output/playwright');
const THEME_STORAGE_KEY = 'iweb-theme-preference';
const DEFAULT_PORT = 4173;
const DEFAULT_TIMEOUT_MS = 60000;
const BF_CACHE_TOP_THRESHOLD_PX = 80;

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    url: '',
    port: null,
    headed: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--headed') {
      options.headed = true;
      continue;
    }
    if (arg === '--url') {
      options.url = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg.startsWith('--url=')) {
      options.url = String(arg.split('=').slice(1).join('=') || '').trim();
      continue;
    }
    if (arg === '--port') {
      options.port = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--port=')) {
      options.port = Number(arg.split('=').slice(1).join('='));
      continue;
    }
    if (arg === '--timeout') {
      options.timeoutMs = Number(argv[index + 1]) || DEFAULT_TIMEOUT_MS;
      index += 1;
      continue;
    }
    if (arg.startsWith('--timeout=')) {
      options.timeoutMs =
        Number(arg.split('=').slice(1).join('=')) || DEFAULT_TIMEOUT_MS;
    }
  }

  return options;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logStep(message) {
  console.log(`[smoke] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function findFreePort(startPort = DEFAULT_PORT) {
  let port = Number(startPort) || DEFAULT_PORT;

  while (port < 65535) {
    const available = await new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(true));
      });
    });

    if (available) {
      return port;
    }

    port += 1;
  }

  throw new Error('No free port available for browser smoke test');
}

function trackChildLogs(child) {
  const lines = [];
  const collect = (chunk, stream) => {
    const text = String(chunk || '');
    if (!text) return;
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue;
      lines.push(`[${stream}] ${line}`);
      if (lines.length > 400) {
        lines.shift();
      }
    }
  };

  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk) => collect(chunk, 'stdout'));
  child.stderr?.on('data', (chunk) => collect(chunk, 'stderr'));

  return lines;
}

async function stopChildProcess(child) {
  if (!child || child.killed) return;

  await new Promise((resolve) => {
    const finish = () => resolve();
    child.once('exit', finish);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }, 1500).unref();
  });
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await delay(350);
  }

  throw new Error(`Timed out waiting for dev server at ${url}`);
}

async function startDevServer(port, timeoutMs) {
  const child = spawn(
    process.execPath,
    ['scripts/dev-workflow.mjs', '--port', String(port)],
    {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    },
  );
  const logs = trackChildLogs(child);

  const earlyExit = new Promise((_, reject) => {
    child.once('exit', (code, signal) => {
      reject(
        new Error(
          `Dev server exited before readiness (code=${code ?? 'null'}, signal=${signal ?? 'null'}).\nLogs:\n${logs.join('\n')}`,
        ),
      );
    });
  });

  const url = `http://127.0.0.1:${port}/`;
  await Promise.race([waitForServer(url, timeoutMs), earlyExit]);

  return { child, logs, url };
}

async function getRuntimeState(page) {
  return page.evaluate(async () => {
    const [{ loadSignals }, { uiStore }, themeModule] = await Promise.all([
      import('/content/core/load-manager.js'),
      import('/content/core/ui-store.js'),
      import('/content/core/theme-state.js'),
    ]);

    return {
      theme: {
        preference: themeModule.themePreference.value,
        resolved: themeModule.resolvedTheme.value,
        system: themeModule.systemTheme.value,
        storedPreference:
          globalThis.localStorage?.getItem?.('iweb-theme-preference') || null,
      },
      loading: {
        blocked: loadSignals.blocked.value,
        pending: loadSignals.pending.value,
        progress: loadSignals.progress.value,
        message: loadSignals.message.value,
        done: loadSignals.done.value,
        hideScheduled: loadSignals.hideScheduled.value,
      },
      ui: uiStore.getState(),
      scrollY: globalThis.scrollY,
      smoke: globalThis.__smoke || null,
      footerExpanded: document.body.classList.contains('footer-expanded'),
      robotWindowOpen:
        document
          .querySelector('#robot-chat-window')
          ?.classList.contains('open') || false,
      robotContainerMenuOpen:
        document
          .querySelector('#robot-companion-container')
          ?.classList.contains('robot-companion--menu-open') || false,
    };
  });
}

async function waitForState(page, label, predicate, timeoutMs = 15000) {
  const start = Date.now();
  let lastState = null;

  while (Date.now() - start < timeoutMs) {
    lastState = await getRuntimeState(page);
    if (predicate(lastState)) {
      return lastState;
    }
    await page.waitForTimeout(120);
  }

  throw new Error(
    `${label} not reached within ${timeoutMs}ms\nLast state: ${JSON.stringify(lastState, null, 2)}`,
  );
}

async function waitForAppReady(page, timeoutMs = 20000) {
  return page.evaluate(
    async ({ timeout }) => {
      const { whenAppReady } = await import('/content/core/load-manager.js');
      return whenAppReady({ timeout });
    },
    { timeout: timeoutMs },
  );
}

async function clickMenuControl(page, selector) {
  await page.evaluate((value) => {
    const host = document.querySelector('site-menu');
    if (!(host instanceof HTMLElement)) {
      throw new Error('site-menu host not found');
    }

    const root = host.shadowRoot || host;
    const element = root.querySelector(value);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Menu control not found: ${value}`);
    }

    element.click();
  }, selector);
}

async function clickDomSelector(page, selector) {
  await page.evaluate((value) => {
    const candidates = Array.from(document.querySelectorAll(value));
    const target = candidates.find((element) => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    if (!(target instanceof HTMLElement)) {
      throw new Error(`DOM control not found: ${value}`);
    }

    target.click();
  }, selector);
}

async function fillMenuSearch(page, value) {
  await page.evaluate((nextValue) => {
    const host = document.querySelector('site-menu');
    if (!(host instanceof HTMLElement)) {
      throw new Error('site-menu host not found');
    }

    const root = host.shadowRoot || host;
    const input = root.querySelector('.menu-search__input');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Menu search input not found');
    }

    input.focus();
    input.value = nextValue;
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }, value);
}

async function getMenuSearchSnapshot(page) {
  return page.evaluate(() => {
    const host = document.querySelector('site-menu');
    if (!(host instanceof HTMLElement)) {
      return { resultsCount: 0, stateText: '', aiText: '' };
    }

    const root = host.shadowRoot || host;
    return {
      resultsCount: root.querySelectorAll('[data-search-index]').length,
      stateText: root.querySelector('.menu-search__state')?.textContent || '',
      aiText: root.querySelector('.menu-search__ai-text')?.textContent || '',
    };
  });
}

function buildSearchPayload(query) {
  const normalized = String(query || '')
    .trim()
    .toLowerCase();
  const hasBlogMatch = normalized.includes('blog');
  return {
    results: hasBlogMatch
      ? [
          {
            title: 'Blog',
            url: '/blog/',
            description: 'Artikel und Updates',
            highlightedDescription:
              '<mark>Blog</mark> Artikel und Updates aus dem Archiv',
            category: 'blog',
          },
        ]
      : [],
    aiChat: {
      message: hasBlogMatch
        ? 'Direkter Treffer: [Blog](/blog/).'
        : 'Keine direkten Treffer.',
    },
  };
}

async function installRoutes(context) {
  await context.route('**/api/search', async (route) => {
    const rawBody = route.request().postData() || '{}';
    const body = (() => {
      try {
        return JSON.parse(rawBody);
      } catch {
        return {};
      }
    })();

    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(buildSearchPayload(body.query)),
    });
  });

  await context.route('**/api/ai-agent', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        text: 'Kurzantwort mit [Blog](/blog/).',
        toolCalls: [],
        hasMemory: false,
        hasImage: false,
      }),
    });
  });
}

async function writeArtifacts(summary, diagnostics) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUTPUT_DIR, 'browser-smoke-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(OUTPUT_DIR, 'browser-smoke-diagnostics.json'),
    `${JSON.stringify(diagnostics, null, 2)}\n`,
    'utf8',
  );
}

async function runSmoke() {
  const options = parseArgs();
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    serverLogs: [],
  };
  const summary = {
    baseUrl: '',
    actualBfcacheRestore: false,
    usedSyntheticBfcacheCheck: false,
    checks: [],
  };

  let server = null;
  let browser = null;
  let context = null;
  let page = null;

  try {
    if (options.url) {
      summary.baseUrl = String(options.url).replace(/\/+$/, '');
      logStep(`using existing server ${summary.baseUrl}`);
    } else {
      const port = options.port || (await findFreePort(DEFAULT_PORT));
      logStep(`starting dev server on port ${port}`);
      server = await startDevServer(port, options.timeoutMs);
      diagnostics.serverLogs = server.logs;
      summary.baseUrl = server.url.replace(/\/+$/, '');
    }

    logStep('launching Chromium');
    browser = await chromium.launch({ headless: !options.headed });
    context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
    });

    await context.addInitScript(
      ({ storageKey }) => {
        globalThis.__smoke = {
          firstThemeSet: null,
          pageshowEvents: [],
          resizeEvents: 0,
          visibilityEvents: 0,
        };

        try {
          if (!globalThis.localStorage?.getItem(storageKey)) {
            globalThis.localStorage?.setItem(storageKey, 'light');
          }
        } catch {
          /* ignore */
        }

        const originalSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function patchedSetAttribute(
          name,
          value,
        ) {
          if (
            this === document.documentElement &&
            name === 'data-theme' &&
            !globalThis.__smoke.firstThemeSet
          ) {
            globalThis.__smoke.firstThemeSet = String(value);
          }

          return originalSetAttribute.call(this, name, value);
        };

        globalThis.addEventListener('pageshow', (event) => {
          globalThis.__smoke.pageshowEvents.push({
            persisted: Boolean(event.persisted),
            href: `${location.pathname}${location.search}`,
          });
        });
        globalThis.addEventListener('resize', () => {
          globalThis.__smoke.resizeEvents += 1;
        });
        document.addEventListener('visibilitychange', () => {
          globalThis.__smoke.visibilityEvents += 1;
        });
      },
      { storageKey: THEME_STORAGE_KEY },
    );

    await installRoutes(context);

    page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') {
        diagnostics.consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      diagnostics.pageErrors.push(
        String(error?.stack || error?.message || error),
      );
    });
    page.on('requestfailed', (request) => {
      const resourceType = request.resourceType();
      if (!['document', 'script', 'fetch', 'xhr'].includes(resourceType))
        return;
      const failure = request.failure()?.errorText || 'unknown failure';
      if (/aborted/i.test(failure)) return;
      diagnostics.requestFailures.push({
        url: request.url(),
        method: request.method(),
        resourceType,
        failure,
      });
    });

    const runId = Date.now();
    const homeUrl = `${summary.baseUrl}/?test=1&t=${runId}`;
    logStep('opening home page');
    await page.goto(homeUrl, {
      waitUntil: 'domcontentloaded',
      timeout: options.timeoutMs,
    });
    await waitForAppReady(page, 20000);

    let state = await waitForState(
      page,
      'app lifecycle ready',
      (value) => value?.loading?.done === true,
      20000,
    );
    assert(
      state.smoke.firstThemeSet === 'light',
      `Expected bootstrap theme to start as light, received ${state.smoke.firstThemeSet}`,
    );
    assert(
      state.theme.resolved === 'light',
      `Expected resolved theme to be light after bootstrap, received ${state.theme.resolved}`,
    );
    assert(
      state.loading.blocked === false,
      'Loader remained blocked after load completion',
    );
    summary.checks.push(
      'theme bootstrap picks persisted preference before app init',
    );
    summary.checks.push('loadSignals finish and unblock the app lifecycle');

    logStep('toggling theme and verifying persistence');
    await clickMenuControl(page, '.site-menu__toggle');
    await waitForState(
      page,
      'menu open',
      (value) => value.ui.menuOpen === true,
      8000,
    );
    await clickMenuControl(page, '.theme-toggle');
    state = await waitForState(
      page,
      'dark theme active',
      (value) =>
        value.theme.resolved === 'dark' &&
        value.theme.storedPreference === 'dark',
      8000,
    );
    assert(
      state.theme.storedPreference === 'dark',
      `Expected stored theme preference to be dark, received ${state.theme.storedPreference}`,
    );
    await page.reload({
      waitUntil: 'domcontentloaded',
      timeout: options.timeoutMs,
    });
    await waitForAppReady(page, 20000);
    state = await waitForState(
      page,
      'dark theme restored after reload',
      (value) =>
        value.theme.resolved === 'dark' &&
        value.loading.done === true &&
        value.smoke.firstThemeSet === 'dark',
      20000,
    );
    summary.checks.push('theme toggle persists across reload and bootstrap');

    logStep('waiting for robot hydration');
    await page.waitForSelector('.robot-avatar', {
      state: 'visible',
      timeout: 15000,
    });
    state = await waitForState(
      page,
      'robot hydration',
      (value) => value.ui.robotHydrated === true,
      15000,
    );
    assert(
      state.ui.robotHydrated === true,
      'Robot never reached hydrated state',
    );

    logStep('opening robot chat and checking menu interplay');
    await clickDomSelector(page, '.robot-avatar');
    state = await waitForState(
      page,
      'robot chat open',
      (value) =>
        value.ui.robotChatOpen === true && value.robotWindowOpen === true,
      12000,
    );
    await clickMenuControl(page, '.site-menu__toggle');
    state = await waitForState(
      page,
      'menu closes robot chat',
      (value) =>
        value.ui.menuOpen === true &&
        value.ui.robotChatOpen === false &&
        value.robotContainerMenuOpen === true,
      12000,
    );
    summary.checks.push(
      'opening the menu closes robot chat and syncs robot UI state',
    );

    logStep('opening search with stubbed results');
    await clickMenuControl(page, '.search-trigger');
    state = await waitForState(
      page,
      'search open',
      (value) => value.ui.searchOpen === true && value.ui.menuOpen === false,
      8000,
    );
    await fillMenuSearch(page, 'blog');
    const searchStart = Date.now();
    let searchSnapshot = await getMenuSearchSnapshot(page);
    while (Date.now() - searchStart < 8000 && searchSnapshot.resultsCount < 1) {
      await page.waitForTimeout(120);
      searchSnapshot = await getMenuSearchSnapshot(page);
    }

    assert(
      searchSnapshot.resultsCount >= 1,
      `Expected at least one search result, received ${JSON.stringify(searchSnapshot)}`,
    );
    assert(
      String(searchSnapshot.aiText || '').includes('Blog'),
      `Expected AI search summary to mention Blog, received ${searchSnapshot.aiText}`,
    );
    await page.keyboard.press('Escape');
    state = await waitForState(
      page,
      'search closed',
      (value) => value.ui.searchOpen === false,
      8000,
    );
    summary.checks.push(
      'menu search resolves via shared store and closes cleanly',
    );

    logStep('checking footer hydration path');
    await clickDomSelector(page, '[data-footer-trigger]');
    state = await waitForState(
      page,
      'footer expanded',
      (value) => value.footerExpanded === true,
      12000,
    );
    assert(
      state.footerExpanded === true,
      'Footer did not expand after trigger click',
    );
    summary.checks.push('footer lazy hydration still opens on user intent');
    await page.evaluate(async () => {
      const module = await import('/content/components/footer/footer.js');
      module.closeFooter();
    });
    await waitForState(
      page,
      'footer collapsed',
      (value) => value.footerExpanded === false,
      8000,
    );

    logStep('checking bfcache restore handling');
    await page.evaluate(() => {
      globalThis.scrollTo(0, 320);
    });
    const aboutUrl = `${summary.baseUrl}/about/?test=1&t=${runId + 1}`;
    await page.goto(aboutUrl, {
      waitUntil: 'domcontentloaded',
      timeout: options.timeoutMs,
    });
    await waitForAppReady(page, 20000);
    await waitForState(
      page,
      'about lifecycle ready',
      (value) => value.loading.done === true,
      20000,
    );
    await page.goBack({
      waitUntil: 'domcontentloaded',
      timeout: options.timeoutMs,
    });
    state = await waitForState(
      page,
      'home restored',
      (value) => value.loading.done === true,
      20000,
    );

    const actualBfcacheRestore = Array.isArray(state.smoke?.pageshowEvents)
      ? state.smoke.pageshowEvents.some((event) => event.persisted === true)
      : false;
    summary.actualBfcacheRestore = actualBfcacheRestore;

    if (actualBfcacheRestore) {
      await page.waitForTimeout(180);
      state = await getRuntimeState(page);
      assert(
        state.scrollY <= BF_CACHE_TOP_THRESHOLD_PX,
        `Expected BFCache restore to reset scroll, received ${state.scrollY}`,
      );
      assert(
        Number(state.smoke?.resizeEvents || 0) > 0,
        'Expected BFCache restore path to dispatch resize',
      );
    } else {
      summary.usedSyntheticBfcacheCheck = true;
      const synthetic = await page.evaluate(() => {
        globalThis.__smoke.resizeEvents = 0;
        globalThis.__smoke.visibilityEvents = 0;
        globalThis.scrollTo(0, 320);
        const event = new Event('pageshow');
        Object.defineProperty(event, 'persisted', {
          value: true,
          configurable: true,
        });
        globalThis.dispatchEvent(event);
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              resizeEvents: globalThis.__smoke.resizeEvents,
              visibilityEvents: globalThis.__smoke.visibilityEvents,
              scrollY: globalThis.scrollY,
            });
          }, 180);
        });
      });

      assert(
        synthetic.resizeEvents > 0,
        'Synthetic BFCache restore did not dispatch resize',
      );
      assert(
        synthetic.visibilityEvents > 0,
        'Synthetic BFCache restore did not dispatch visibilitychange',
      );
      assert(
        synthetic.scrollY <= BF_CACHE_TOP_THRESHOLD_PX,
        `Synthetic BFCache restore did not reset scroll, received ${synthetic.scrollY}`,
      );
    }
    summary.checks.push('bfcache restore path resumes layout/scroll lifecycle');

    assert(
      diagnostics.consoleErrors.length === 0,
      `Console errors detected: ${diagnostics.consoleErrors.join(' | ')}`,
    );
    assert(
      diagnostics.pageErrors.length === 0,
      `Page errors detected: ${diagnostics.pageErrors.join(' | ')}`,
    );
    assert(
      diagnostics.requestFailures.length === 0,
      `Request failures detected: ${JSON.stringify(diagnostics.requestFailures)}`,
    );

    await writeArtifacts(summary, diagnostics);
    logStep('browser smoke passed');
  } catch (error) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    if (page) {
      try {
        await page.screenshot({
          path: path.join(OUTPUT_DIR, 'browser-smoke-failure.png'),
          fullPage: true,
        });
      } catch {
        /* ignore */
      }
    }

    await writeArtifacts(
      {
        ...summary,
        error: String(error?.stack || error?.message || error),
      },
      diagnostics,
    );

    throw error;
  } finally {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
    if (server?.child) {
      await stopChildProcess(server.child);
    }
  }
}

runSmoke()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    const message = String(error?.stack || error?.message || error);
    console.error(`[smoke] failed: ${message}`);
    if (/Executable doesn't exist|browserType\.launch/i.test(message)) {
      console.error(
        '[smoke] hint: run `npx playwright install chromium` once.',
      );
    }
    process.exit(1);
  });
