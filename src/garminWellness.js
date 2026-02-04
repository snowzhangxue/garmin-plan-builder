function safeNumber(value) {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function summarizeSleep(sleepData) {
  if (!sleepData) return null;

  const summary = sleepData?.dailySleepDTO || sleepData?.sleepSummaryDTO || null;
  const durationMs =
    summary?.sleepTimeSeconds != null
      ? summary.sleepTimeSeconds * 1000
      : summary?.sleepTime != null
        ? summary.sleepTime
        : null;

  return {
    durationMinutes:
      typeof durationMs === "number" ? Math.round(durationMs / 1000 / 60) : null,
    deepMinutes: safeNumber(summary?.deepSleepSeconds)
      ? Math.round(summary.deepSleepSeconds / 60)
      : safeNumber(summary?.deepSleep)
        ? Math.round(summary.deepSleep / 1000 / 60)
        : null,
    remMinutes: safeNumber(summary?.remSleepSeconds)
      ? Math.round(summary.remSleepSeconds / 60)
      : safeNumber(summary?.remSleep)
        ? Math.round(summary.remSleep / 1000 / 60)
        : null,
    lightMinutes: safeNumber(summary?.lightSleepSeconds)
      ? Math.round(summary.lightSleepSeconds / 60)
      : safeNumber(summary?.lightSleep)
        ? Math.round(summary.lightSleep / 1000 / 60)
        : null,
    awakeMinutes: safeNumber(summary?.awakeSleepSeconds)
      ? Math.round(summary.awakeSleepSeconds / 60)
      : safeNumber(summary?.awakeSleep)
        ? Math.round(summary.awakeSleep / 1000 / 60)
        : null,
    sleepScore: safeNumber(summary?.sleepScore) ?? safeNumber(summary?.overallSleepScore),
    raw: summary
  };
}

function summarizeSteps(stepsData) {
  if (!stepsData) return null;
  const steps =
    safeNumber(stepsData?.steps) ??
    safeNumber(stepsData?.totalSteps) ??
    safeNumber(stepsData?.dailySteps);
  return {
    steps,
    raw: stepsData
  };
}

function summarizeHeartRate(hrData) {
  if (!hrData) return null;

  const resting =
    safeNumber(hrData?.restingHeartRate) ?? safeNumber(hrData?.restingHR);

  const min = safeNumber(hrData?.minHeartRate) ?? safeNumber(hrData?.minHR);
  const max = safeNumber(hrData?.maxHeartRate) ?? safeNumber(hrData?.maxHR);

  return {
    resting,
    min,
    max,
    raw: hrData
  };
}

function summarizeWeight(weightData) {
  if (!weightData) return null;

  // Library returns different shapes; keep it flexible.
  const weightKg =
    safeNumber(weightData?.weight) ??
    safeNumber(weightData?.weightKg) ??
    (safeNumber(weightData?.weightInGrams)
      ? weightData.weightInGrams / 1000
      : null);

  const bodyFatPct =
    safeNumber(weightData?.bodyFat) ?? safeNumber(weightData?.bodyFatPercent);

  return {
    weightKg,
    bodyFatPct,
    raw: weightData
  };
}

async function fetchWellnessForDate({ client, date } = {}) {
  if (!client) throw new Error("Missing Garmin client.");
  if (!date) throw new Error("Missing date.");

  const result = {
    date,
    sleep: null,
    steps: null,
    heartRate: null,
    weight: null,
    wellnessRaw: null
  };

  // Each endpoint is best-effort; Garmin accounts vary by device/features.
  try {
    const sleepData = await client.getSleepData(date);
    result.sleep = summarizeSleep(sleepData);
  } catch (error) {
    // ignore
  }

  try {
    const stepsData = await client.getSteps(date);
    result.steps = summarizeSteps(stepsData);
  } catch (error) {
    // ignore
  }

  try {
    const hrData = await client.getHeartRate(date);
    result.heartRate = summarizeHeartRate(hrData);
  } catch (error) {
    // ignore
  }

  try {
    const weightData = await client.getDailyWeightData(date);
    result.weight = summarizeWeight(weightData);
  } catch (error) {
    // ignore
  }

  try {
    const wellness = await client.downloadWellnessData(date);
    result.wellnessRaw = wellness;
  } catch (error) {
    // ignore
  }

  return result;
}

module.exports = {
  fetchWellnessForDate
};
