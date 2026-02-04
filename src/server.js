const fs = require("fs");
const path = require("path");
const http = require("http");

const { loginGarmin } = require("./garminAuth");
const { fetchActivitySummaryForDate } = require("./garminActivities");
const { generateActivitySummary } = require("./openAiSummary");
const { loadConfig } = require("./config");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "public");

// Reuse a single Garmin client across requests to avoid re-auth on every click.
let cachedClient = null;
let cachedUsername = null;
let loginInFlight = null;

function clearGarminClient() {
  cachedClient = null;
  cachedUsername = null;
  loginInFlight = null;
}

async function getGarminClient({ username, password }) {
  if (cachedClient && cachedUsername === username) {
    return cachedClient;
  }

  if (loginInFlight && cachedUsername === username) {
    return loginInFlight;
  }

  cachedUsername = username;
  loginInFlight = (async () => {
    const result = await loginGarmin({ username, password });
    cachedClient = result.client;
    return cachedClient;
  })();

  try {
    return await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}

function loadOptionalConfig() {
  try {
    return loadConfig(process.cwd());
  } catch (error) {
    if (error.code !== "CONFIG_MISSING") {
      console.warn("Failed to load config file:", error.message);
    }
    return {};
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": contentType });
    res.end(data);
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    return sendFile(res, path.join(PUBLIC_DIR, "index.html"), "text/html");
  }

  if (req.method === "GET" && req.url === "/styles.css") {
    return sendFile(res, path.join(PUBLIC_DIR, "styles.css"), "text/css");
  }

  if (req.method === "GET" && req.url === "/app.js") {
    return sendFile(res, path.join(PUBLIC_DIR, "app.js"), "text/javascript");
  }

  if (req.method === "GET" && req.url === "/api/config") {
    const config = loadOptionalConfig();
    if (!config.username) {
      return sendJson(res, 200, {
        ok: false,
        message:
          "Missing Garmin credentials. Copy config/garmin-config.sample.json to config/garmin-config.json and fill in username/password."
      });
    }

    return sendJson(res, 200, {
      ok: true,
      username: config.username
    });
  }

  if (req.method === "POST" && req.url === "/api/activity-summary") {
    try {
      const config = loadOptionalConfig();
      const payload = await parseJsonBody(req);
      const date = payload?.date;

      const username = config.username?.trim();
      const password = config.password;

      if (!username || !password) {
        return sendJson(res, 400, {
          ok: false,
          message:
            "Missing Garmin credentials in config/garmin-config.json (username/password)."
        });
      }

      if (!date) {
        return sendJson(res, 400, {
          ok: false,
          message: "Date is required."
        });
      }

      const client = await getGarminClient({ username, password });

      let summaries;
      try {
        summaries = await fetchActivitySummaryForDate({
          client,
          date
        });
      } catch (error) {
        // If the cached client token is stale, clear and retry once.
        console.warn("Fetch failed; retrying with fresh Garmin login.", {
          message: error.message,
          status: error.status
        });
        clearGarminClient();
        const freshClient = await getGarminClient({ username, password });
        summaries = await fetchActivitySummaryForDate({
          client: freshClient,
          date
        });
      }

      if (!summaries) {
        return sendJson(res, 200, {
          ok: true,
          summary: null,
          message: "No activities found for that date."
        });
      }

      const provider = (
        process.env.SUMMARY_PROVIDER ||
        config.summaryProvider ||
        "gemini"
      ).toLowerCase();
      const apiKey =
        provider === "gemini"
          ? process.env.GEMINI_API_KEY || config.geminiApiKey
          : process.env.OPENAI_API_KEY || config.openaiApiKey;
      const model = process.env.SUMMARY_MODEL || config.summaryModel;
      let narrative = "";
      if (apiKey) {
        try {
          narrative = await generateActivitySummary({
            apiKey,
            model,
            provider,
            date,
            summaries
          });
        } catch (error) {
          console.error("LLM summary failed:", {
            message: error.message,
            status: error.status,
            body: error.body?.slice?.(0, 500)
          });
        }
      } else {
        const keyName =
          provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY";
        console.warn(`${keyName} not set; skipping LLM summary.`);
      }

      return sendJson(res, 200, {
        ok: true,
        summary: {
          activities: summaries,
          narrative
        }
      });
    } catch (error) {
      console.error("Activity summary request failed:", {
        message: error.message,
        status: error.status,
        body: error.body?.slice?.(0, 500)
      });
      const status = error.status || 500;
      return sendJson(res, status, {
        ok: false,
        message: "Unable to fetch activity summary. Please try again."
      });
    }
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Garmin summary UI running at http://${HOST}:${PORT}`);
});
