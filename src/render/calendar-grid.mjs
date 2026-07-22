const DAYS_PER_WEEK = 7;

function utcWeekday(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function positionCalendarDays(daily) {
  const firstWeekday = utcWeekday(daily[0].date);
  return daily.map((day, index) => {
    const position = firstWeekday + index;
    return Object.freeze({
      day,
      column: Math.floor(position / DAYS_PER_WEEK),
      row: position % DAYS_PER_WEEK,
    });
  });
}

export function splitCalendarBands(daily) {
  const midpoint = Math.ceil(daily.length / 2);
  const midpointEndWeekday = utcWeekday(daily[midpoint - 1].date);
  const daysUntilSaturday = (6 - midpointEndWeekday + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const splitIndex = midpoint + daysUntilSaturday;
  return Object.freeze([
    Object.freeze(daily.slice(0, splitIndex)),
    Object.freeze(daily.slice(splitIndex)),
  ]);
}
