const fs = require("fs");
const path = require("path");

const { buildGarminPlan } = require("./planParser");
const { getIsoWeekRangeUTC } = require("./dateUtils");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function listInputFiles(inputDir) {
  if (!fs.existsSync(inputDir)) {
    return [];
  }
  return fs
    .readdirSync(inputDir)
    .map((entry) => path.join(inputDir, entry))
    .filter((entry) => fs.statSync(entry).isFile());
}

function parseWeekFromFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  const match = base.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (Number.isNaN(year) || Number.isNaN(week)) {
    return null;
  }
  return { year, week, base };
}

function generatePlans({ rootDir, planName, logger } = {}) {
  const resolvedRoot = rootDir ? path.resolve(rootDir) : process.cwd();
  const inputDir = path.join(resolvedRoot, "input-plans");
  const outputDir = path.join(resolvedRoot, "plans");
  const log = logger || console;

  ensureDir(outputDir);

  const allFiles = listInputFiles(inputDir);
  const selectedFiles = planName
    ? allFiles.filter((file) => path.basename(file, path.extname(file)) === planName)
    : allFiles;

  if (planName && selectedFiles.length === 0) {
    throw new Error(`No input plan found matching ${planName} in ${inputDir}.`);
  }

  const results = [];

  for (const filePath of selectedFiles) {
    const metadata = parseWeekFromFilename(filePath);
    if (!metadata) {
      log.warn(`Skipping ${filePath}: filename must look like YYYY-WW (e.g. 2026-05).`);
      continue;
    }

    const { year, week, base } = metadata;
    const { start, end, startDate, endDate } = getIsoWeekRangeUTC(year, week);
    const content = fs.readFileSync(filePath, "utf8");
    const plan = buildGarminPlan({
      title: `Week ${week} ${year}`,
      week,
      year,
      start,
      end,
      content,
      sourceFile: path.basename(filePath)
    });

    const outputName = `${startDate} - ${endDate}.json`;
    const outputPath = path.join(outputDir, outputName);
    fs.writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

    results.push({
      input: base,
      output: outputName,
      startDate,
      endDate
    });
  }

  return results;
}

module.exports = {
  generatePlans,
  parseWeekFromFilename
};
