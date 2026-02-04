const fs = require("fs");
const path = require("path");

function resolveConfigPath(rootDir) {
  if (process.env.GARMIN_CONFIG_PATH) {
    return path.resolve(process.env.GARMIN_CONFIG_PATH);
  }
  return path.join(rootDir, "config", "garmin-config.json");
}

function loadConfig(rootDir) {
  const configPath = resolveConfigPath(rootDir);
  if (!fs.existsSync(configPath)) {
    const samplePath = path.join(rootDir, "config", "garmin-config.sample.json");
    const message = `Missing config at ${configPath}. Copy ${samplePath} to config/garmin-config.json and fill in your credentials.`;
    const error = new Error(message);
    error.code = "CONFIG_MISSING";
    throw error;
  }
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

module.exports = {
  loadConfig,
  resolveConfigPath
};
