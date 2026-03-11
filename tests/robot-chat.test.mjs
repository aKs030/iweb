import assert from "node:assert/strict";
import test from "node:test";

import { __test__ } from "../content/components/robot-companion/modules/robot-chat.js";

test("getRecoveryFollowUpAction recognizes confirmation and switching intents", () => {
  assert.equal(__test__.getRecoveryFollowUpAction("ja"), "confirm");
  assert.equal(__test__.getRecoveryFollowUpAction("Profil laden"), "confirm");
  assert.equal(
    __test__.getRecoveryFollowUpAction("anderes Profil"),
    "different",
  );
  assert.equal(
    __test__.getRecoveryFollowUpAction("Gerät trennen"),
    "disconnect",
  );
  assert.equal(__test__.getRecoveryFollowUpAction("Vielleicht"), "");
});

test("formatRecoveredProfileSummary shows loaded memories concisely", () => {
  const text = __test__.formatRecoveredProfileSummary([
    { key: "name", value: "Ada" },
    { key: "location", value: "Berlin" },
  ]);

  assert.match(text, /Profil geladen/);
  assert.match(text, /\*\*name\*\*: Ada/);
  assert.match(text, /\*\*location\*\*: Berlin/);
});
