const form = document.querySelector("#summary-form");
const statusEl = document.querySelector("#status");
const summaryEmpty = document.querySelector("#summary-empty");
const summaryContent = document.querySelector("#summary-content");
const summaryType = document.querySelector("#summary-type");
const summaryHr = document.querySelector("#summary-hr");
const summaryMetrics = document.querySelector("#summary-metrics");
const summaryNarrative = document.querySelector("#summary-narrative");
const submitButton = form.querySelector("button[type=\"submit\"]");
const usernameInput = document.querySelector("#username-input");
const usernameOptions = document.querySelector("#username-options");
const passwordField = document.querySelector("#password-field");
const configStatus = document.querySelector("#config-status");

function setPasswordRequired(required) {
  if (required) {
    passwordField.classList.remove("hidden");
    const input = passwordField.querySelector("input");
    if (input) input.required = true;
  } else {
    passwordField.classList.add("hidden");
    const input = passwordField.querySelector("input");
    if (input) {
      input.required = false;
      input.value = "";
    }
  }
}

async function loadSessions() {
  try {
    const response = await fetch("/api/sessions");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      configStatus.textContent = data.message || "Unable to load sessions.";
      configStatus.style.color = "#b42318";
      submitButton.disabled = true;
      return;
    }

    const usernames = data.usernames || [];
    usernameOptions.innerHTML = "";

    if (usernames.length === 0) {
      configStatus.textContent =
        "No saved sessions found yet. Enter a username and password to login.";
      configStatus.style.color = "var(--ink-muted)";
      setPasswordRequired(true);
      submitButton.disabled = false;
      return;
    }

    for (const username of usernames) {
      const option = document.createElement("option");
      option.value = username;
      usernameOptions.appendChild(option);
    }

    // Preselect the first known username for convenience.
    if (!usernameInput.value) {
      usernameInput.value = usernames[0];
    }

    configStatus.textContent = "Select an account and pick a date.";
    configStatus.style.color = "var(--ink-muted)";

    // Password is optional when a session exists; server will request it if needed.
    setPasswordRequired(false);
  } catch (error) {
    configStatus.textContent = "Unable to load sessions.";
    configStatus.style.color = "#b42318";
    submitButton.disabled = true;
  }
}

loadSessions();

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

  const days = summary.days || [];
  const windowText =
    summary.startDate && summary.endDate
      ? `${summary.startDate} → ${summary.endDate}`
      : "8-day window";

  const daysWithTraining = days.filter((d) => (d.activities || []).length > 0);

  summaryType.textContent = `${windowText} · ${daysWithTraining.length}/${days.length} days with training`;

  const lastDay = days.length ? days[days.length - 1] : null;
  const resting = lastDay?.wellness?.heartRate?.resting;
  summaryHr.textContent =
    typeof resting === "number" ? `Resting HR ${resting} bpm` : "Resting HR unavailable";

  summaryMetrics.textContent =
    days
      .map((d) => {
        const activityText = (d.activities || [])
          .map((a) => `${a.type}(${a.count})`)
          .join(", ");
        const sleepMin = d.wellness?.sleep?.durationMinutes;
        const sleepText =
          typeof sleepMin === "number"
            ? `sleep ${Math.round(sleepMin / 60)}h${String(sleepMin % 60).padStart(2, "0")}`
            : "sleep ?";
        return `${d.date}: ${activityText || "no training"} · ${sleepText}`;
      })
      .join(" | ") || "No data";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Signing in and fetching your activity...");
  submitButton.disabled = true;

  const formData = new FormData(form);
  const payload = {
    username: formData.get("username"),
    password: formData.get("password"),
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
      if (data && data.needsLogin) {
        setPasswordRequired(true);
      }

      setStatus(
        data.message || "Request failed. Please check your details.",
        "error"
      );
      setSummary(undefined);
      return;
    }

    // On success, hide password prompt again.
    setPasswordRequired(false);

    setStatus("Summary ready.");
    setSummary(data.summary);
  } catch (error) {
    setStatus("Something went wrong. Please retry.", "error");
    setSummary(undefined);
  } finally {
    submitButton.disabled = false;
  }
});
