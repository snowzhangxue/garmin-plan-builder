const { loadConfig } = require("./config");
const { loginGarmin } = require("./garminAuth");

async function main() {
  let config;
  try {
    config = loadConfig(process.cwd());
  } catch (error) {
    if (error.code === "CONFIG_MISSING") {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const result = await loginGarmin({
    username: config.username,
    password: config.password
  });

  console.log("Login response:");
  console.log(`- user: ${result.userProfile?.userName || "unknown"}`);
  console.log(`- name: ${result.userProfile?.fullName || "unknown"}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Login failed:", error.message);
    process.exit(1);
  });
}
