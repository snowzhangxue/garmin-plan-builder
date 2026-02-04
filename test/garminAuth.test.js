const assert = require("node:assert/strict");
const { test } = require("node:test");

const { buildSigninPayload } = require("../src/garminAuth");

test("buildSigninPayload encodes username and password", () => {
  const payload = buildSigninPayload({ username: "u", password: "p" });
  assert.match(payload, /username=u/);
  assert.match(payload, /password=p/);
});
