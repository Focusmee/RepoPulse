import test from "node:test";
import assert from "node:assert/strict";
import { parseTrendingFullNames } from "../src/collectors/githubTrending.js";

test("trending parser ignores non-repository navigation links", () => {
  const html = `
    <h2><a href="/sponsors/explore">Explore sponsors</a></h2>
    <h2><a href="/features/actions">Actions</a></h2>
    <h2><a href="/owner/repo">owner / repo</a></h2>
    <h2><a href="/another-owner/another.repo">another-owner / another.repo</a></h2>
  `;

  assert.deepEqual(parseTrendingFullNames(html), ["owner/repo", "another-owner/another.repo"]);
});

test("trending parser removes duplicate repositories case-insensitively", () => {
  const html = `
    <h2><a href="/Owner/Repo">Owner / Repo</a></h2>
    <h2><a href="/owner/repo">owner / repo</a></h2>
  `;

  assert.deepEqual(parseTrendingFullNames(html), ["Owner/Repo"]);
});
