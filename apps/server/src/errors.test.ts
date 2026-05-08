import assert from "node:assert/strict";
import test from "node:test";
import { appErrorFromUnknown, sanitizeErrorDetail } from "./errors.js";

test("sanitizeErrorDetail redacts secrets and local home paths", () => {
  const detail = sanitizeErrorDetail("Authorization: Bearer sk-test token=abc /home/alice/project");
  assert.equal(detail.includes("sk-test"), false);
  assert.equal(detail.includes("abc"), false);
  assert.equal(detail.includes("/home/alice"), false);
});

test("appErrorFromUnknown maps rate limits and retry policy", () => {
  const error = appErrorFromUnknown(Object.assign(new Error("Too many requests"), { status: 429 }), { requestPath: "/api/sessions/1" });
  assert.equal(error.kind, "app_error");
  assert.equal(error.type, "rate_limit");
  assert.equal(error.statusCode, 429);
  assert.equal(error.retry.kind, "retry_request");
  assert.equal(error.target?.requestPath, "/api/sessions/1");
});
