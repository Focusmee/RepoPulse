import test from "node:test";
import assert from "node:assert/strict";
import { classifyRepo, isDeepReadEligibleClass, isProjectInspirationClass } from "../src/rankers/repoClassifier.js";

test("repo classifier keeps awesome lists out of deep read", () => {
  const repoClass = classifyRepo({
    full_name: "demo/awesome-agent-apps",
    description: "A curated list of AI agent resources",
    topics: ["agent", "resources"]
  });

  assert.equal(repoClass.type, "resource_collection");
  assert.equal(isDeepReadEligibleClass(repoClass), false);
  assert.equal(isProjectInspirationClass(repoClass), true);
});

test("repo classifier treats starters as project inspiration", () => {
  const repoClass = classifyRepo({
    full_name: "demo/full-stack-agent-template",
    description: "Starter template for agent apps",
    topics: ["template"]
  });

  assert.equal(repoClass.type, "template_or_starter");
  assert.equal(isProjectInspirationClass(repoClass), true);
});

test("repo classifier does not infer type from generated project ideas", () => {
  const repoClass = classifyRepo(
    {
      full_name: "demo/agent-runtime",
      description: "Runtime for production agent workflows",
      topics: ["agent", "runtime"]
    },
    {
      project_idea: "Use it as a starter template for a portfolio project"
    }
  );

  assert.notEqual(repoClass.type, "template_or_starter");
  assert.equal(isDeepReadEligibleClass(repoClass), true);
});
