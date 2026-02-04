function metersToKm(distanceMeters) {
  return distanceMeters / 1000;
}

function metersPerSecondToKph(speedMetersPerSecond) {
  return speedMetersPerSecond * 3.6;
}

function formatNumber(value, digits = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return value.toFixed(digits);
}

function summarizeActivity(activity) {
  const activityType =
    activity?.activityType?.displayName ||
    activity?.activityType?.typeKey ||
    "Activity";
  const averageHeartRate = activity?.averageHR ?? null;
  const maxHeartRate = activity?.maxHR ?? null;
  const distanceMeters = activity?.distance ?? null;
  const durationSeconds = activity?.duration ?? null;
  const averageSpeed = activity?.averageSpeed ?? null;
  const calories = activity?.calories ?? null;

  const metrics = [];

  if (typeof distanceMeters === "number") {
    metrics.push(`Distance ${formatNumber(metersToKm(distanceMeters), 2)} km`);
  }

  if (typeof durationSeconds === "number") {
    metrics.push(`Duration ${formatNumber(durationSeconds / 60, 0)} min`);
  }

  if (typeof averageSpeed === "number") {
    metrics.push(
      `Avg speed ${formatNumber(metersPerSecondToKph(averageSpeed), 1)} km/h`
    );
  }

  if (typeof calories === "number") {
    metrics.push(`Calories ${formatNumber(calories, 0)} kcal`);
  }

  return {
    type: activityType,
    heartRate: {
      average: averageHeartRate,
      max: maxHeartRate
    },
    metrics,
    raw: {
      distanceMeters,
      durationSeconds,
      averageSpeed,
      calories
    }
  };
}

function getActivityDate(activity) {
  const startTime = activity?.startTimeLocal || activity?.startTimeGMT;
  if (!startTime || typeof startTime !== "string") {
    return null;
  }
  return startTime.split(" ")[0];
}

function aggregateActivities(summaries) {
  const grouped = new Map();

  summaries.forEach((summary) => {
    const key = summary.type || "Activity";
    if (!grouped.has(key)) {
      grouped.set(key, {
        type: key,
        activities: [],
        totals: {
          distanceMeters: 0,
          durationSeconds: 0,
          calories: 0
        },
        heartRate: {
          weightedSum: 0,
          durationSeconds: 0,
          max: null
        }
      });
    }

    const bucket = grouped.get(key);
    bucket.activities.push(summary);

    const { distanceMeters, durationSeconds, calories } = summary.raw || {};
    if (typeof distanceMeters === "number") {
      bucket.totals.distanceMeters += distanceMeters;
    }
    if (typeof durationSeconds === "number") {
      bucket.totals.durationSeconds += durationSeconds;
      if (typeof summary.heartRate?.average === "number") {
        bucket.heartRate.weightedSum +=
          summary.heartRate.average * durationSeconds;
        bucket.heartRate.durationSeconds += durationSeconds;
      }
    }
    if (typeof calories === "number") {
      bucket.totals.calories += calories;
    }
    if (typeof summary.heartRate?.max === "number") {
      bucket.heartRate.max =
        bucket.heartRate.max === null
          ? summary.heartRate.max
          : Math.max(bucket.heartRate.max, summary.heartRate.max);
    }
  });

  return Array.from(grouped.values()).map((bucket) => {
    const avgHr =
      bucket.heartRate.durationSeconds > 0
        ? bucket.heartRate.weightedSum / bucket.heartRate.durationSeconds
        : null;
    const avgSpeed =
      bucket.totals.durationSeconds > 0
        ? bucket.totals.distanceMeters / bucket.totals.durationSeconds
        : null;

    const metrics = [];
    if (bucket.totals.distanceMeters > 0) {
      metrics.push(
        `Distance ${formatNumber(metersToKm(bucket.totals.distanceMeters), 2)} km`
      );
    }
    if (bucket.totals.durationSeconds > 0) {
      metrics.push(
        `Duration ${formatNumber(bucket.totals.durationSeconds / 60, 0)} min`
      );
    }
    if (typeof avgSpeed === "number" && avgSpeed > 0) {
      metrics.push(
        `Avg speed ${formatNumber(metersPerSecondToKph(avgSpeed), 1)} km/h`
      );
    }
    if (bucket.totals.calories > 0) {
      metrics.push(`Calories ${formatNumber(bucket.totals.calories, 0)} kcal`);
    }

    return {
      type: bucket.type,
      count: bucket.activities.length,
      heartRate: {
        average: avgHr ? Number(avgHr.toFixed(0)) : null,
        max: bucket.heartRate.max
      },
      metrics
    };
  });
}

async function fetchActivitySummaryForDate({ client, date } = {}) {
  if (!date) {
    throw new Error("Date is required to fetch activity summary.");
  }

  if (!client) {
    throw new Error("Missing Garmin client.");
  }

  const pageSize = 20;
  const maxPages = 10;
  const summaries = [];

  for (let page = 0; page < maxPages; page += 1) {
    const activities = await client.getActivities(page * pageSize, pageSize);
    if (!Array.isArray(activities) || activities.length === 0) {
      break;
    }

    for (const activity of activities) {
      if (getActivityDate(activity) === date) {
        summaries.push(summarizeActivity(activity));
      }
    }

    const oldestActivityDate = getActivityDate(
      activities[activities.length - 1]
    );
    if (oldestActivityDate && oldestActivityDate < date) {
      break;
    }
  }

  if (summaries.length === 0) {
    return null;
  }

  return aggregateActivities(summaries);
}

module.exports = {
  fetchActivitySummaryForDate
};
