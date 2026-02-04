const fs = require("fs");
const path = require("path");
const http = require("http");

const { loginGarmin, validateSessionForUser, listValidUsers } = require("./garminAuth");
const { fetchActivitySummaryForDateRange } = require("./garminActivities");
const { fetchWellnessForDate } = require("./garminWellness");
const { generateEightDaySummaryAndPlan } = require("./llmSummary");
const { loadConfig } = require("./config");
const {
  getTrailingDateRange,
  addDaysUTC,
  formatDateUTC,
  parseDateUTC
} = require("./dateUtils");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "public");

// Reuse Garmin clients across requests per username.
const cachedClients = new Map();
const loginInflight = new Map();

function clearGarminClient(username) {
  if (username) {
    cachedClients.delete(username);
    loginInflight.delete(username);
    return;
  }
  cachedClients.clear();
  loginInflight.clear();
}

async function getGarminClient({ username, password }) {
  if (!username) {
    throw new Error("Username is required");
  }

  if (cachedClients.has(username)) {
    return cachedClients.get(username);
  }

  if (loginInflight.has(username)) {
    return loginInflight.get(username);
  }

  const inflightPromise = (async () => {
    // First try: use an existing token-only session (no password needed).
    const existing = await validateSessionForUser({ username });
    if (existing?.client) {
      cachedClients.set(username, existing.client);
      return existing.client;
    }

    // If no session, require password.
    if (!password) {
      const error = new Error("Password required");
      error.code = "PASSWORD_REQUIRED";
      throw error;
    }

    const result = await loginGarmin({ username, password });
    cachedClients.set(username, result.client);
    return result.client;
  })();

  loginInflight.set(username, inflightPromise);

  try {
    return await inflightPromise;
  } finally {
    loginInflight.delete(username);
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

  if (req.method === "GET" && req.url === "/api/sessions") {
    try {
      const usernames = await listValidUsers();
      return sendJson(res, 200, {
        ok: true,
        usernames
      });
    } catch (error) {
      console.error("Unable to list sessions:", { message: error.message });
      return sendJson(res, 500, {
        ok: false,
        message: "Unable to list sessions."
      });
    }
  }

  if (req.method === "POST" && req.url === "/api/activity-summary") {
    try {
      const payload = await parseJsonBody(req);
      const username = payload?.username?.trim();
      const password = payload?.password;
      const date = payload?.date;

      if (!username) {
        return sendJson(res, 400, {
          ok: false,
          message: "Username is required."
        });
      }

      if (!date) {
        return sendJson(res, 400, {
          ok: false,
          message: "Date is required."
        });
      }

      const config = loadOptionalConfig();

      let client;
      try {
        client = await getGarminClient({ username, password });
      } catch (error) {
        if (error.code === "PASSWORD_REQUIRED") {
          return sendJson(res, 401, {
            ok: false,
            needsLogin: true,
            message: "No active session for this user. Please enter a password to login."
          });
        }

        console.error("Garmin client init failed:", { message: error.message });
        return sendJson(res, 500, {
          ok: false,
          message: "Unable to authenticate with Garmin."
        });
      }

      const range = getTrailingDateRange(date, 7);

      function listDatesInclusive(startDateString, endDateString) {
        const start = parseDateUTC(startDateString);
        const end = parseDateUTC(endDateString);
        if (!start || !end) return [];
        const dates = [];
        let cursor = start;
        while (cursor <= end) {
          dates.push(formatDateUTC(cursor));
          cursor = addDaysUTC(cursor, 1);
        }
        return dates;
      }

      let activityRange;
      try {
        activityRange = await fetchActivitySummaryForDateRange({
          client,
          startDate: range.startDate,
          endDate: range.endDate
        });
      } catch (error) {
        console.warn("Fetch failed; retrying with fresh Garmin login.", {
          message: error.message,
          status: error.status
        });
        clearGarminClient(username);
        const freshClient = await getGarminClient({ username, password });
        activityRange = await fetchActivitySummaryForDateRange({
          client: freshClient,
          startDate: range.startDate,
          endDate: range.endDate
        });
      }

      const dateList = listDatesInclusive(range.startDate, range.endDate);
      const activitiesByDate = new Map(
        (activityRange?.days || []).map((day) => [day.date, day.activities])
      );

      const days = [];
      for (const d of dateList) {
        const wellness = await fetchWellnessForDate({ client, date: d });
        days.push({
          date: d,
          activities: activitiesByDate.get(d) || null,
          wellness
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
          narrative = await generateEightDaySummaryAndPlan({
            apiKey,
            model,
            provider,
            startDate: range.startDate,
            endDate: range.endDate,
            days
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
          startDate: range.startDate,
          endDate: range.endDate,
          days,
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
