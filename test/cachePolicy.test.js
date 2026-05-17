import test from "node:test";
import assert from "node:assert/strict";
import { shouldReuseDocument } from "../src/documents/cachePolicy.js";

test("document cache is reused while fresh", () => {
  const reused = shouldReuseDocument(
    {
      readme_text: "# Demo",
      last_fetched_at: "2026-05-18T00:00:00.000Z"
    },
    {
      pushed_at: "2026-05-17T00:00:00.000Z"
    },
    {
      ttlHours: 72,
      now: new Date("2026-05-18T12:00:00.000Z")
    }
  );

  assert.equal(reused, true);
});

test("document cache expires by ttl or repo push time", () => {
  const existing = {
    readme_text: "# Demo",
    last_fetched_at: "2026-05-10T00:00:00.000Z"
  };

  assert.equal(
    shouldReuseDocument(existing, { pushed_at: "2026-05-09T00:00:00.000Z" }, { ttlHours: 72, now: new Date("2026-05-18T00:00:00.000Z") }),
    false
  );

  assert.equal(
    shouldReuseDocument(
      { readme_text: "# Demo", last_fetched_at: "2026-05-18T00:00:00.000Z" },
      { pushed_at: "2026-05-18T01:00:00.000Z" },
      { ttlHours: 72, now: new Date("2026-05-18T02:00:00.000Z") }
    ),
    false
  );
});
