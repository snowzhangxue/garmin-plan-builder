const form = document.querySelector("#summary-form");
const statusEl = document.querySelector("#status");
const summaryEmpty = document.querySelector("#summary-empty");
const summaryContent = document.querySelector("#summary-content");
const summaryType = document.querySelector("#summary-type");
const summaryHr = document.querySelector("#summary-hr");
const summaryMetrics = document.querySelector("#summary-metrics");
const summaryNarrative = document.querySelector("#summary-narrative");
const submitButton = form.querySelector("button[type=\"submit\"]");
const configuredUsername = document.querySelector("#configured-username");
const configStatus = document.querySelector("#config-status");

async function loadConfiguredAccount() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      configuredUsername.textContent = "Not configured";
      configStatus.textContent =
        data.message ||
        "Missing Garmin credentials. Please create config/garmin-config.json.";
      configStatus.style.color = "#b42318";
      submitButton.disabled = true;
      return;
    }

    configuredUsername.textContent = data.username;
    configStatus.textContent =
      "Using credentials from config/garmin-config.json.";
    configStatus.style.color = "var(--ink-muted)";
  } catch (error) {
    configuredUsername.textContent = "Not available";
    configStatus.textContent = "Unable to load config status.";
    configStatus.style.color = "#b42318";
    submitButton.disabled = true;
  }
}

loadConfiguredAccount();

function setStatus(message, tone = "neutral") {
  statusEl.textContent = message;
  statusEl.style.color = tone === "error" ? "#b42318" : "var(--ink-muted)";
}

function setSummary(summary) {
  if (summary === undefined) {
    summaryContent.classList.add("hidden");
    summaryEmpty.textContent =
      "Submit your Garmin credentials and a date to see the result here.";
    summaryEmpty.classList.remove("hidden");
    return;
  }

  if (!summary) {
    summaryContent.classList.add("hidden");
    summaryEmpty.textContent = "No activities found for that date.";
    summaryEmpty.classList.remove("hidden");
    return;
  }

  summaryEmpty.classList.add("hidden");
  summaryContent.classList.remove("hidden");
  summaryNarrative.textContent =
    summary.narrative || "Summary is unavailable right now.";

  const activities = summary.activities || [];
  const typeText =
    activities.length > 0
      ? activities.map((item) => `${item.type} (${item.count})`).join(", ")
      : "Activity";
  summaryType.textContent = typeText;

  const avg =
    activities.length === 1 ? activities[0].heartRate?.average : null;
  const max = activities.length === 1 ? activities[0].heartRate?.max : null;
  const hrText =
    typeof avg === "number"
      ? `Avg ${avg} bpm${typeof max === "number" ? ` · Max ${max} bpm` : ""}`
      : activities.length === 1
        ? "No heart rate data"
        : "Heart rate listed per activity type";
  summaryHr.textContent = hrText;

  summaryMetrics.textContent =
    activities.length > 0
      ? activities
          .map((item) => {
            const metricText = item.metrics?.length
              ? item.metrics.join(" · ")
              : "No metrics";
            return `${item.type}: ${metricText}`;
          })
          .join(" | ")
      : "No additional metrics";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Signing in and fetching your activity...");
  submitButton.disabled = true;

  const formData = new FormData(form);
  const payload = {
    date: formData.get("date")
  };

  try {
    const response = await fetch("/api/activity-summary", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      setStatus(
        data.message || "Login failed. Please check your details.",
        "error"
      );
      setSummary(undefined);
      return;
    }

    setStatus("Summary ready.");
    setSummary(data.summary);
  } catch (error) {
    setStatus("Something went wrong. Please retry.", "error");
    setSummary(undefined);
  } finally {
    submitButton.disabled = false;
  }
});
