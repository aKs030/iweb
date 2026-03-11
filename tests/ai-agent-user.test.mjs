import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPost } from "../functions/api/ai-agent-user.js";

function createEnv() {
  const store = new Map();

  return {
    store,
    env: {
      SITEMAP_CACHE_KV: {
        async get(key) {
          return store.has(key) ? store.get(key) : null;
        },
        async put(key, value) {
          store.set(key, String(value));
        },
        async delete(key) {
          store.delete(key);
        },
        async list({ prefix = "" } = {}) {
          return {
            keys: [...store.keys()]
              .filter((key) => key.startsWith(prefix))
              .map((name) => ({ name })),
            list_complete: true,
          };
        },
      },
      JULES_MEMORY: {
        async deleteByMetadata() {},
        async upsert() {},
      },
      AI: {
        async run() {
          return { data: [[1, 2, 3]] };
        },
      },
    },
  };
}

function createRequest(body, headers = {}) {
  return new Request("https://example.com/api/ai-agent-user", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("ai-agent-user activates a target profile and returns its memories", async () => {
  const state = createEnv();
  state.store.set(
    "robot-memory:u_legacy",
    JSON.stringify([
      { key: "name", value: "Ada", timestamp: Date.now() - 10_000 },
      { key: "location", value: "Berlin", timestamp: Date.now() - 5_000 },
    ]),
  );

  const response = await onRequestPost({
    request: createRequest({ action: "activate", targetUserId: "u_legacy" }),
    env: state.env,
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.userId, "u_legacy");
  assert.equal(payload.profile?.name, "Ada");
  assert.equal(payload.memories.length, 2);
  assert.match(
    response.headers.get("set-cookie") || "",
    /jules_user_id=u_legacy/,
  );
});

test("ai-agent-user updates singleton memories and syncs name lookup keys", async () => {
  const state = createEnv();
  state.store.set(
    "robot-memory:u_test",
    JSON.stringify([
      { key: "name", value: "Ada", timestamp: Date.now() - 10_000 },
      { key: "location", value: "Berlin", timestamp: Date.now() - 5_000 },
    ]),
  );
  state.store.set("username:ada", "u_test");

  const response = await onRequestPost({
    request: createRequest(
      {
        action: "update-memory",
        key: "name",
        value: "Grace",
        previousValue: "Ada",
      },
      {
        "x-jules-user-id": "u_test",
      },
    ),
    env: state.env,
  });
  const payload = await response.json();
  const storedMemories = JSON.parse(
    state.store.get("robot-memory:u_test") || "[]",
  );

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.profile?.name, "Grace");
  assert.ok(
    storedMemories.some(
      (entry) => entry.key === "name" && entry.value === "Grace",
    ),
  );
  assert.ok(
    !storedMemories.some(
      (entry) => entry.key === "name" && entry.value === "Ada",
    ),
  );
  assert.equal(state.store.get("username:grace"), "u_test");
  assert.equal(state.store.has("username:ada"), false);
});

test("ai-agent-user disconnect clears the profile cookie without deleting memories", async () => {
  const state = createEnv();
  state.store.set(
    "robot-memory:u_test",
    JSON.stringify([{ key: "name", value: "Ada", timestamp: Date.now() }]),
  );

  const response = await onRequestPost({
    request: createRequest(
      { action: "disconnect" },
      { Cookie: "jules_user_id=u_test" },
    ),
    env: state.env,
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.userId, "");
  assert.match(response.headers.get("set-cookie") || "", /Max-Age=0/);
  assert.ok(state.store.has("robot-memory:u_test"));
});
