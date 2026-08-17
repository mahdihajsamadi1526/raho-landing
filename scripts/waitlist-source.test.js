"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { waitlistSourceFromQuery } = require("../lib/waitlist-source");

test("waitlistSourceFromQuery: no query -> landing", () => {
  assert.strictEqual(waitlistSourceFromQuery(""), "landing");
  assert.strictEqual(waitlistSourceFromQuery(undefined), "landing");
});

test("waitlistSourceFromQuery: ?src=telegram_berlin -> telegram_berlin", () => {
  assert.strictEqual(waitlistSourceFromQuery("?src=telegram_berlin"), "telegram_berlin");
});

test("waitlistSourceFromQuery: reads src among other params", () => {
  assert.strictEqual(waitlistSourceFromQuery("?utm_x=1&src=instagram_x&y=2"), "instagram_x");
});

test("waitlistSourceFromQuery: uppercase is lowercased", () => {
  assert.strictEqual(waitlistSourceFromQuery("?src=Telegram-Berlin"), "telegram-berlin");
});

test("waitlistSourceFromQuery: strips unsafe characters", () => {
  assert.strictEqual(waitlistSourceFromQuery("?src=<script>alert(1)</script>"), "scriptalert1script");
});

test("waitlistSourceFromQuery: empty after sanitizing -> landing", () => {
  assert.strictEqual(waitlistSourceFromQuery("?src=%20%20%20"), "landing");
});

test("waitlistSourceFromQuery: truncated to 64 chars", () => {
  const long = "a".repeat(100);
  assert.strictEqual(waitlistSourceFromQuery("?src=" + long), "a".repeat(64));
});
