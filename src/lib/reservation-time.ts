import { HttpError } from "./errors";
import { clockTime, minutes, type BusinessConfig } from "./business-config";

export function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new HttpError(400, "Use a valid reservation date.");
  const date = new Date(`${value}T12:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new HttpError(400, "Use a valid reservation date.");
  return date;
}
export function localParts(date: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => p.find((part) => part.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
// Match possible timezone offsets rather than interpreting restaurant time in the
// server/browser timezone. Reject skipped/ambiguous DST times instead of guessing.
export function zonedTime(date: string, time: string, zone: string) {
  calendarDate(date);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new HttpError(400, "Use a valid reservation time.");
  const naive = Date.parse(`${date}T${time}:00Z`);
  const candidates = new Set<number>();
  for (let offset = -36; offset <= 36; offset += 6) {
    const probe = naive + offset * 3600000;
    const local = localParts(new Date(probe), zone);
    const delta = Date.parse(`${local.date}T${local.time}:00Z`) - probe;
    const possible = naive - delta;
    const match = localParts(new Date(possible), zone);
    if (match.date === date && match.time === time) candidates.add(possible);
  }
  if (candidates.size !== 1)
    throw new HttpError(
      400,
      "That local time is unavailable during a clock change. Choose another time.",
    );
  return new Date([...candidates][0]);
}
export function reservationWindow(
  config: BusinessConfig,
  date: string,
  time: string,
  now = new Date(),
) {
  if (!config.reservationsEnabled || !config.timeZone || !config.hours.length)
    throw new HttpError(
      503,
      "Reservations are closed until the restaurant configures its hours and timezone.",
    );
  const day = calendarDate(date).getUTCDay();
  const hours = config.hours.find((h) => h.day === day);
  const minute = minutes(time);
  if (
    !hours ||
    minute < minutes(hours.opens) ||
    (minute - minutes(hours.opens)) % config.slotMinutes !== 0
  )
    throw new HttpError(
      400,
      "Choose a time within the configured operating hours.",
    );
  const startsAt = zonedTime(date, time, config.timeZone);
  const endsAt = new Date(
    startsAt.getTime() + config.reservationMinutes * 60000,
  );
  const end = localParts(endsAt, config.timeZone);
  if (end.date !== date || end.time > hours.closes)
    throw new HttpError(400, "This booking would finish after closing time.");
  if (startsAt.getTime() < now.getTime() + config.leadMinutes * 60000)
    throw new HttpError(
      400,
      "This time is past or inside the required booking lead time.",
    );
  const today = localParts(now, config.timeZone).date;
  if (
    calendarDate(date).getTime() - calendarDate(today).getTime() >
    config.horizonDays * 86400000
  )
    throw new HttpError(400, "This date is outside the booking window.");
  return { startsAt, endsAt };
}
export function timesForDate(
  config: BusinessConfig,
  date: string,
  now = new Date(),
) {
  const day = calendarDate(date).getUTCDay();
  const hours = config.hours.find((h) => h.day === day);
  if (!config.reservationsEnabled || !hours || !config.timeZone) return [];
  const result: { time: string; startsAt: Date; endsAt: Date }[] = [];
  for (
    let minute = minutes(hours.opens);
    minute <= minutes(hours.closes) - config.reservationMinutes;
    minute += config.slotMinutes
  ) {
    const time = clockTime(minute);
    try {
      result.push({ time, ...reservationWindow(config, date, time, now) });
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
    }
  }
  return result;
}
