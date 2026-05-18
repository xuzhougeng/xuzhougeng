import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveProviderTarget,
  RULES_DEF,
} from "../../../../tools/shared/mihomo/provider-catalog.mjs";

test("AI Suite provider catalog keeps the ordinary Proxy default", () => {
  const aiSuite = Object.values(RULES_DEF)
    .flat()
    .find(rule => rule.name === "AI Suite");

  assert.equal(aiSuite.defaultAction, "Proxy");
});

test("resolveProviderTarget only forces AI Suite to AI-Relay when AI relay is available", () => {
  const aiSuite = Object.values(RULES_DEF)
    .flat()
    .find(rule => rule.name === "AI Suite");
  const options = ["DIRECT", "REJECT", "Auto", "Proxy", "AI-Relay"];

  assert.equal(resolveProviderTarget(aiSuite, "", options), "Proxy");
  assert.equal(resolveProviderTarget(aiSuite, "Auto", options), "Auto");
  assert.equal(
    resolveProviderTarget(aiSuite, "Proxy", options, {
      aiRelayAvailable: true,
      aiRelayGroup: "AI-Relay",
    }),
    "AI-Relay"
  );
});
