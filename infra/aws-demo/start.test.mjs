// @vitest-environment node
import { test } from "vitest";
import assert from "node:assert/strict";
import { validateDemoEnvironment } from "./start.mjs";

const sandbox = { CLERK_SECRET_KEY: "sk_test_fixture", STRIPE_SECRET_KEY: "sk_test_fixture", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_fixture", QR_SIGNING_SECRET: "a".repeat(64), APP_URL: "https://example.lambda-url.us-east-1.on.aws", DATABASE_URL: "postgresql://demo:fixture@db.example/demo" };
test("rejects live or missing credentials without including their values in errors", () => {
  for (const key of ["CLERK_SECRET_KEY", "STRIPE_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]) {
    for (const value of ["sk_live_never_print_this", undefined]) {
      assert.throws(() => validateDemoEnvironment({ ...sandbox, [key]: value }), error => error.message.includes(key) && !error.message.includes("never_print_this"));
    }
  }
});
test("demo always disables email, preserves secrets and validates required URLs/key", () => {
  assert.deepEqual(validateDemoEnvironment({ ...sandbox, NOTIFICATIONS_ENABLED: "true" }), { ...sandbox, NOTIFICATIONS_ENABLED: "false" });
  for (const override of [{ APP_URL: "http://example.com" }, { APP_URL: "https://private@example.com" }, { DATABASE_URL: "https://example.com" }, { QR_SIGNING_SECRET: "wrong" }]) assert.throws(() => validateDemoEnvironment({ ...sandbox, ...override }));
});
