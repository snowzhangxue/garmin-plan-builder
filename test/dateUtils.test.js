const assert = require("node:assert/strict");
const { test } = require("node:test");

const { getIsoWeekRangeUTC } = require("../src/dateUtils");

test("getIsoWeekRangeUTC returns expected dates for 2026 week 5", () => {
  const { startDate, endDate } = getIsoWeekRangeUTC(2026, 5);
  assert.equal(startDate, "2026-01-26");
  assert.equal(endDate, "2026-02-01");
});
