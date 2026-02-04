function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDateUTC(date) {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  return `${year}-${month}-${day}`;
}

function getIsoWeekStartUTC(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // Monday=1, Sunday=7
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7);
  return monday;
}

function getIsoWeekRangeUTC(year, week) {
  const start = getIsoWeekStartUTC(year, week);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return {
    start,
    end,
    startDate: formatDateUTC(start),
    endDate: formatDateUTC(end)
  };
}

module.exports = {
  formatDateUTC,
  getIsoWeekRangeUTC,
  getIsoWeekStartUTC
};
