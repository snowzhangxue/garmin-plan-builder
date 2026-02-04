const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { generatePlans } = require("../src/generatePlans");

function createTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "garmin-plan-"));
  fs.mkdirSync(path.join(root, "config"), { recursive: true });
  fs.mkdirSync(path.join(root, "input-plans"), { recursive: true });
  fs.mkdirSync(path.join(root, "plans"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "config", "garmin-config.json"),
    JSON.stringify({ username: "u", password: "p" }, null, 2)
  );
  return root;
}

test("generatePlans writes output file with expected naming", () => {
  const root = createTempProject();
  const planPath = path.join(root, "input-plans", "2026-05.txt");
  fs.writeFileSync(planPath, "Mon: Easy run\nWed: Intervals\n");

  const results = generatePlans({ rootDir: root });
  assert.equal(results.length, 1);
  assert.equal(results[0].output, "2026-01-26 - 2026-02-01.json");

  const outputPath = path.join(root, "plans", results[0].output);
  assert.ok(fs.existsSync(outputPath));
});
