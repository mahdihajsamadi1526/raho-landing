"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyWaitlistResponse } = require("../lib/classify-waitlist");

test("classifyWaitlistResponse: 201 -> success", () => {
  assert.strictEqual(classifyWaitlistResponse({ status: 201, ok: true }), "success");
});

test("classifyWaitlistResponse: 200 -> success", () => {
  assert.strictEqual(classifyWaitlistResponse({ status: 200, ok: true }), "success");
});

test("classifyWaitlistResponse: 409 -> duplicate", () => {
  assert.strictEqual(classifyWaitlistResponse({ status: 409, ok: false }), "duplicate");
});

test("classifyWaitlistResponse: 500 -> error", () => {
  assert.strictEqual(classifyWaitlistResponse({ status: 500, ok: false }), "error");
});

test("classifyWaitlistResponse: network-fail (ok:false, status:0) -> error", () => {
  // fetch rejects on network error before a response is received;
  // callers that build a synthetic object to represent that case get "error".
  assert.strictEqual(classifyWaitlistResponse({ status: 0, ok: false }), "error");
});
