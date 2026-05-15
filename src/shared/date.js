const DEFAULT_TIMEZONE = process.env.REPOPULSE_TIMEZONE || "Asia/Shanghai";

export function todayString(timeZone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
}

export function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromDateString, toDateString = todayString()) {
  if (!fromDateString) return Number.POSITIVE_INFINITY;
  const from = new Date(`${fromDateString.slice(0, 10)}T00:00:00.000Z`).getTime();
  const to = new Date(`${toDateString.slice(0, 10)}T00:00:00.000Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function isoDaysAgo(days, baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
