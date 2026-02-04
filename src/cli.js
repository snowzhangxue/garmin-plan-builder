const { loadConfig } = require("./config");
const { generatePlans } = require("./generatePlans");

function parseArgs(argv) {
  const args = [...argv];
  let planName = null;

  while (args.length) {
    const current = args.shift();
    if (current === "--plan" && args.length) {
      planName = args.shift();
      continue;
    }
    if (!current.startsWith("--") && !planName) {
      planName = current;
    }
  }

  return { planName };
}

function main() {
  try {
    loadConfig(process.cwd());
  } catch (error) {
    if (error.code === "CONFIG_MISSING") {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const { planName } = parseArgs(process.argv.slice(2));
  const results = generatePlans({ planName });

  if (results.length === 0) {
    console.log("No plans generated.");
    return;
  }

  console.log("Generated plans:");
  for (const result of results) {
    console.log(`- ${result.input} -> ${result.output}`);
  }
}

if (require.main === module) {
  main();
}
