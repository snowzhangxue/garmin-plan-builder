const { formatDateUTC } = require("./dateUtils");

const DAY_MAP = {
  mon: 0,
  monday: 0,
  tue: 1,
  tues: 1,
  tuesday: 1,
  wed: 2,
  weds: 2,
  wednesday: 2,
  thu: 3,
  thur: 3,
  thurs: 3,
  thursday: 3,
  fri: 4,
  friday: 4,
  sat: 5,
  saturday: 5,
  sun: 6,
  sunday: 6
};

function parsePlainEnglishPlan(content, weekStartDate) {
  const lines = content.split(/\r?\n/);
  const workouts = [];
  const notes = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z]{3,9})\s*:\s*(.+)$/);
    if (!match) {
      notes.push(trimmed);
      continue;
    }

    const dayToken = match[1].toLowerCase();
    const description = match[2].trim();
    const dayIndex = DAY_MAP[dayToken];
    if (dayIndex === undefined) {
      notes.push(trimmed);
      continue;
    }

    const workoutDate = new Date(weekStartDate);
    workoutDate.setUTCDate(weekStartDate.getUTCDate() + dayIndex);

    workouts.push({
      date: formatDateUTC(workoutDate),
      description
    });
  }

  return { workouts, notes };
}

function buildGarminPlan({ title, week, year, start, end, content, sourceFile }) {
  const { workouts, notes } = parsePlainEnglishPlan(content, start);

  return {
    format: "garmin-plan-v1",
    title,
    week,
    year,
    startDate: formatDateUTC(start),
    endDate: formatDateUTC(end),
    workouts,
    notes,
    sourceFile
  };
}

module.exports = {
  buildGarminPlan,
  parsePlainEnglishPlan
};
