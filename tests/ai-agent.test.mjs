import assert from "node:assert/strict";
import test from "node:test";

import { __test__, onRequestPost } from "../functions/api/ai-agent.js";

function buildEmbedding(text) {
  const normalized = String(text || "");
  let checksum = 0;
  for (const char of normalized) {
    checksum = (checksum + char.charCodeAt(0)) % 997;
  }
  return [normalized.length, checksum, normalized.split(/\s+/).length];
}

function createRequest(body) {
  return new Request("https://example.com/api/ai-agent", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createTestEnv(overrides = {}) {
  const fallbackStore = new Map();
  const vectorUpserts = [];
  const chatRuns = [];

  const env = {
    ROBOT_CHAT_MODEL: "chat-model",
    ROBOT_EMBEDDING_MODEL: "embed-model",
    ROBOT_CONTEXT_TIMEOUT_MS: "80",
    SITEMAP_CACHE_KV: {
      async get(key) {
        return fallbackStore.has(key) ? fallbackStore.get(key) : null;
      },
      async put(key, value) {
        fallbackStore.set(key, value);
      },
    },
    JULES_MEMORY: {
      async upsert(vectors) {
        vectorUpserts.push(vectors);
      },
      async query() {
        return { matches: [] };
      },
    },
    AI: {
      async run(model, payload) {
        if (model === "embed-model") {
          return { data: payload.text.map(buildEmbedding) };
        }

        chatRuns.push({ model, payload });
        return {
          response: "Kurze Antwort",
          tool_calls: [],
        };
      },
      autorag() {
        return {
          async aiSearch() {
            return { data: [] };
          },
        };
      },
    },
    ...overrides,
  };

  return {
    env,
    fallbackStore,
    vectorUpserts,
    chatRuns,
  };
}

function buildConfig(overrides = {}) {
  return {
    chatModel: "chat-model",
    embeddingModel: "embed-model",
    imageModel: "image-model",
    maxMemoryResults: 5,
    memoryScoreThreshold: 0.65,
    memoryRetentionDays: 180,
    maxHistoryTurns: 10,
    maxTokens: 512,
    contextTimeoutMs: 80,
    toolTrustedIds: new Set(),
    toolAdminIds: new Set(),
    enabledIntegrations: new Set(["links", "social", "email", "calendar"]),
    ...overrides,
  };
}

test("withTimeout returns fallback when operation exceeds deadline", async () => {
  const startedAt = Date.now();
  const value = await __test__.withTimeout(
    () => new Promise((resolve) => setTimeout(() => resolve("late"), 30)),
    5,
    { fallbackValue: "fallback" },
  );

  assert.equal(value, "fallback");
  assert.ok(Date.now() - startedAt < 25);
});

test("resolveUserIdentity falls back to cookie user id", async () => {
  const identity = await __test__.resolveUserIdentity(
    new Request("https://example.com/api/ai-agent", {
      headers: {
        Cookie: "jules_user_id=u_cookie123",
      },
    }),
    "",
    "",
    null,
  );

  assert.equal(identity.userId, "u_cookie123");
});

test("resolveUserIdentity flags a known profile for confirmation instead of auto-loading it", async () => {
  const identity = await __test__.resolveUserIdentity(
    new Request("https://example.com/api/ai-agent"),
    "",
    "Ich heiße Ada",
    {
      SITEMAP_CACHE_KV: {
        async get(key) {
          if (key === "username:ada") return "u_legacy";
          return null;
        },
      },
    },
  );

  assert.match(identity.userId, /^u_/);
  assert.notEqual(identity.userId, "u_legacy");
  assert.deepEqual(identity.recovery, {
    status: "needs_confirmation",
    name: "Ada",
    candidateUserId: "u_legacy",
  });
});

test("resolveUserIdentity does not recover ambiguous name mappings", async () => {
  const identity = await __test__.resolveUserIdentity(
    new Request("https://example.com/api/ai-agent"),
    "",
    "Ich heiße Ada",
    {
      SITEMAP_CACHE_KV: {
        async get(key) {
          if (key === "username:ada") return "__conflict__";
          return null;
        },
      },
    },
  );

  assert.match(identity.userId, /^u_/);
  assert.notEqual(identity.userId, "u_legacy");
  assert.deepEqual(identity.recovery, {
    status: "conflict",
    name: "Ada",
    candidateUserId: "",
  });
});

test("extractNameFromPrompt only accepts explicit self-identification", () => {
  assert.equal(__test__.extractNameFromPrompt("Ich heiße Ada"), "Ada");
  assert.equal(
    __test__.extractNameFromPrompt("Mein Name ist Ada Lovelace"),
    "Ada Lovelace",
  );
  assert.equal(__test__.extractNameFromPrompt("Ich bin Ada"), "");
  assert.equal(__test__.extractNameFromPrompt("Ich bin Entwickler"), "");
});

test("extractPromptMemoryFacts keeps chained facts without inventing a name", () => {
  const facts = __test__.extractPromptMemoryFacts(
    "Ich bin Entwickler und wohne in Berlin und spreche Deutsch.",
  );

  assert.ok(!facts.some((entry) => entry.key === "name"));
  assert.ok(
    facts.some((entry) => entry.key === "location" && entry.value === "Berlin"),
  );
  assert.ok(
    facts.some(
      (entry) => entry.key === "language" && entry.value === "Deutsch",
    ),
  );
});

test("extractPromptMemoryFacts captures explicit name plus chained profile facts", () => {
  const facts = __test__.extractPromptMemoryFacts(
    "Ich heiße Ada und wohne in Berlin und spreche Deutsch.",
  );

  assert.ok(
    facts.some((entry) => entry.key === "name" && entry.value === "Ada"),
  );
  assert.ok(
    facts.some((entry) => entry.key === "location" && entry.value === "Berlin"),
  );
  assert.ok(
    facts.some(
      (entry) => entry.key === "language" && entry.value === "Deutsch",
    ),
  );
});

test("persistPromptMemories batches KV and Vectorize writes", async () => {
  const state = createTestEnv();

  const stored = await __test__.persistPromptMemories(
    state.env,
    "u_test",
    "Ich heiße Ada; ich wohne in Berlin; ich arbeite als Entwicklerin bei OpenAI.",
    buildConfig(),
  );

  assert.equal(stored.length, 4);
  assert.equal(state.vectorUpserts.length, 1);
  assert.equal(state.vectorUpserts[0].length, 4);

  const fallbackPayload = JSON.parse(
    state.fallbackStore.get("robot-memory:u_test") || "[]",
  );
  assert.equal(fallbackPayload.length, 4);
  assert.ok(
    fallbackPayload.some(
      (entry) => entry.key === "location" && entry.value === "Berlin",
    ),
  );
  assert.ok(
    fallbackPayload.some(
      (entry) => entry.key === "company" && entry.value === "OpenAI",
    ),
  );
  assert.equal(state.fallbackStore.get("username:ada"), "u_test");
});

test("persistPromptMemories keeps existing identifier name stable", async () => {
  const state = createTestEnv();
  state.fallbackStore.set(
    "robot-memory:u_test",
    JSON.stringify([
      {
        key: "name",
        value: "Ada",
        timestamp: Date.now() - 5_000,
      },
    ]),
  );

  const stored = await __test__.persistPromptMemories(
    state.env,
    "u_test",
    "Ich heiße Grace; ich wohne in Berlin.",
    buildConfig(),
  );

  assert.equal(stored.length, 1);
  assert.deepEqual(
    stored.map((entry) => ({ key: entry.key, value: entry.value })),
    [{ key: "location", value: "Berlin" }],
  );
  assert.equal(state.vectorUpserts.length, 1);
  assert.equal(state.vectorUpserts[0].length, 1);

  const fallbackPayload = JSON.parse(
    state.fallbackStore.get("robot-memory:u_test") || "[]",
  );
  assert.ok(
    fallbackPayload.some(
      (entry) => entry.key === "name" && entry.value === "Ada",
    ),
  );
  assert.ok(
    !fallbackPayload.some(
      (entry) => entry.key === "name" && entry.value === "Grace",
    ),
  );
});

test("persistPromptMemories updates the stored name on explicit rename intent", async () => {
  const state = createTestEnv();
  state.fallbackStore.set(
    "robot-memory:u_rename",
    JSON.stringify([
      {
        key: "name",
        value: "Ada",
        timestamp: Date.now() - 5_000,
      },
    ]),
  );

  const stored = await __test__.persistPromptMemories(
    state.env,
    "u_rename",
    "Bitte ändere meinen Namen zu Grace. Ich wohne in Berlin.",
    buildConfig(),
  );

  assert.equal(stored.length, 2);
  assert.ok(
    stored.some((entry) => entry.key === "name" && entry.value === "Grace"),
  );
  assert.ok(
    stored.some(
      (entry) => entry.key === "location" && entry.value === "Berlin",
    ),
  );

  const fallbackPayload = JSON.parse(
    state.fallbackStore.get("robot-memory:u_rename") || "[]",
  );
  assert.ok(
    fallbackPayload.some(
      (entry) => entry.key === "name" && entry.value === "Grace",
    ),
  );
  assert.ok(
    !fallbackPayload.some(
      (entry) => entry.key === "name" && entry.value === "Ada",
    ),
  );
  assert.equal(state.fallbackStore.get("username:grace"), "u_rename");
  assert.equal(state.fallbackStore.has("username:ada"), false);
});

test("storeMemory does not rewrite an existing name for the same identifier", async () => {
  const state = createTestEnv();
  state.fallbackStore.set(
    "robot-memory:u_name",
    JSON.stringify([
      {
        key: "name",
        value: "Ada",
        timestamp: Date.now() - 5_000,
      },
    ]),
  );

  const repeatedName = await __test__.storeMemory(
    state.env,
    "u_name",
    "name",
    "Ada",
    buildConfig(),
  );
  const conflictingName = await __test__.storeMemory(
    state.env,
    "u_name",
    "name",
    "Grace",
    buildConfig(),
  );

  assert.equal(repeatedName.success, true);
  assert.equal(repeatedName.skipped, true);
  assert.match(repeatedName.message, /Name bleibt "Ada"/);
  assert.equal(conflictingName.success, false);
  assert.equal(conflictingName.skipped, true);
  assert.match(conflictingName.error, /Ada/);
  assert.equal(state.vectorUpserts.length, 0);

  const fallbackPayload = JSON.parse(
    state.fallbackStore.get("robot-memory:u_name") || "[]",
  );
  assert.ok(
    fallbackPayload.some(
      (entry) => entry.key === "name" && entry.value === "Ada",
    ),
  );
  assert.ok(
    !fallbackPayload.some(
      (entry) => entry.key === "name" && entry.value === "Grace",
    ),
  );
});

test("storeMemory allows an explicit name overwrite when confirmed", async () => {
  const state = createTestEnv();
  state.fallbackStore.set(
    "robot-memory:u_name_change",
    JSON.stringify([
      {
        key: "name",
        value: "Ada",
        timestamp: Date.now() - 5_000,
      },
    ]),
  );

  const changedName = await __test__.storeMemory(
    state.env,
    "u_name_change",
    "name",
    "Grace",
    buildConfig(),
    { allowNameOverwrite: true },
  );

  assert.equal(changedName.success, true);
  assert.equal(changedName.skipped, undefined);
  assert.equal(state.vectorUpserts.length, 1);

  const fallbackPayload = JSON.parse(
    state.fallbackStore.get("robot-memory:u_name_change") || "[]",
  );
  assert.ok(
    fallbackPayload.some(
      (entry) => entry.key === "name" && entry.value === "Grace",
    ),
  );
  assert.ok(
    !fallbackPayload.some(
      (entry) => entry.key === "name" && entry.value === "Ada",
    ),
  );
  assert.equal(state.fallbackStore.get("username:grace"), "u_name_change");
  assert.equal(state.fallbackStore.has("username:ada"), false);
});

test("schedulePromptMemoryPersistence hands background writes to waitUntil", async () => {
  let releaseRead = null;
  const blockedRead = new Promise((resolve) => {
    releaseRead = resolve;
  });
  const fallbackStore = new Map();
  const waitUntilCalls = [];

  const env = {
    ...createTestEnv().env,
    SITEMAP_CACHE_KV: {
      async get() {
        await blockedRead;
        return fallbackStore.get("robot-memory:u_wait") || null;
      },
      async put(key, value) {
        fallbackStore.set(key, value);
      },
    },
    JULES_MEMORY: {
      async upsert() {},
      async query() {
        return { matches: [] };
      },
    },
  };

  __test__.schedulePromptMemoryPersistence(
    {
      waitUntil(promise) {
        waitUntilCalls.push(promise);
      },
    },
    env,
    "u_wait",
    "Ich heiße Ada;",
    buildConfig(),
  );

  assert.equal(waitUntilCalls.length, 1);
  const earlyOutcome = await Promise.race([
    waitUntilCalls[0].then(() => "resolved"),
    new Promise((resolve) => setTimeout(() => resolve("pending"), 20)),
  ]);
  assert.equal(earlyOutcome, "pending");

  releaseRead();
  await waitUntilCalls[0];

  const stored = JSON.parse(fallbackStore.get("robot-memory:u_wait") || "[]");
  assert.ok(
    stored.some((entry) => entry.key === "name" && entry.value === "Ada"),
  );
});

test("onRequestPost asks for confirmation before cross-browser name recovery", async () => {
  const state = createTestEnv();
  state.fallbackStore.set("username:ada", "u_legacy");
  state.fallbackStore.set(
    "robot-memory:u_legacy",
    JSON.stringify([
      {
        key: "name",
        value: "Ada",
        timestamp: Date.now() - 10_000,
      },
      {
        key: "location",
        value: "Berlin",
        timestamp: Date.now() - 9_000,
      },
    ]),
  );

  const response = await onRequestPost({
    request: createRequest({
      prompt: "Ich heiße Ada. Was weißt du über mich?",
      stream: false,
    }),
    env: state.env,
    waitUntil() {},
  });

  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.match(payload.userId, /^u_/);
  assert.notEqual(payload.userId, "u_legacy");
  assert.match(payload.text, /Profil für Ada gefunden/);
  assert.equal(payload.recovery?.status, "needs_confirmation");
  assert.equal(payload.recovery?.candidateUserId, "u_legacy");
  assert.equal(payload.profile?.status, "recovery-pending");
  assert.equal(state.chatRuns.length, 0);
});

test("onRequestPost keeps responding when memory and content RAG are slow", async () => {
  const state = createTestEnv();
  state.env.RAG_ID = "rag-test";
  state.env.AI = {
    async run(model, payload) {
      if (model === "embed-model") {
        return { data: payload.text.map(buildEmbedding) };
      }

      state.chatRuns.push({ model, payload });
      return {
        response: "Kurze Antwort",
        tool_calls: [],
      };
    },
    autorag() {
      return {
        async aiSearch() {
          return {
            data: [
              {
                filename: "blog/web-components-zukunft",
                title: "Web Components Zukunft",
                text: "AutoRAG Fallback über Web Components.",
              },
            ],
          };
        },
      };
    },
  };
  state.env.ROBOT_CONTENT_RAG = {
    async query() {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return { matches: [] };
    },
  };
  state.env.JULES_MEMORY = {
    async upsert() {},
    async query() {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return { matches: [] };
    },
  };

  const waitUntilCalls = [];
  const startedAt = Date.now();
  const response = await onRequestPost({
    request: createRequest({
      prompt: "Wie denkt Abdulkerim über Web Components?",
      userId: "u_test",
      stream: false,
    }),
    env: state.env,
    waitUntil(promise) {
      waitUntilCalls.push(promise);
    },
  });
  const elapsed = Date.now() - startedAt;
  const payload = await response.json();
  const systemMessage =
    state.chatRuns[0]?.payload?.messages?.[0]?.content || "";

  assert.equal(response.status, 200);
  assert.ok(elapsed < 700);
  assert.equal(payload.text, "Kurze Antwort");
  assert.equal(waitUntilCalls.length, 1);
  assert.match(systemMessage, /\*\*WEBSITE-KONTEXT \(RAG\):\*\*/);
  assert.match(systemMessage, /AutoRAG Fallback/);
});
