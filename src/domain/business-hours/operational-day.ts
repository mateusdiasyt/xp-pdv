type BusinessClockSettings = {
  businessTimezone?: string;
  businessDayStartsAt?: string;
  businessDayEndsAt?: string;
};

type Ymd = {
  year: number;
  month: number;
  day: number;
};

type Clock = {
  hour: number;
  minute: number;
};

export type OperationalDayRange = {
  businessDate: Ymd;
  businessDateKey: string;
  start: Date;
  end: Date;
  timezone: string;
  startsAt: string;
  endsAt: string;
};

const defaultSettings = {
  timezone: "America/Sao_Paulo",
  startsAt: "19:00",
  endsAt: "01:00",
};

function parseClock(value?: string): Clock {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");

  if (!match) {
    return {
      hour: 0,
      minute: 0,
    };
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

function clockMinutes(clock: Clock) {
  return clock.hour * 60 + clock.minute;
}

function formatClock(clock: Clock) {
  return `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`;
}

function formatYmd(date: Ymd) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function addDays(date: Ymd, days: number): Ymd {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12, 0, 0, 0));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function addMonths(date: Ymd, months: number): Ymd {
  const next = new Date(Date.UTC(date.year, date.month - 1 + months, 1, 12, 0, 0, 0));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: 1,
  };
}

function getZonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const byType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(byType.get("year")),
    month: Number(byType.get("month")),
    day: Number(byType.get("day")),
    hour: Number(byType.get("hour")),
    minute: Number(byType.get("minute")),
    second: Number(byType.get("second")),
  };
}

function zonedTimeToUtc(date: Ymd, clock: Clock, timezone: string) {
  const targetWallTime = Date.UTC(date.year, date.month - 1, date.day, clock.hour, clock.minute, 0, 0);
  let utcTime = targetWallTime;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zoned = getZonedParts(new Date(utcTime), timezone);
    const actualWallTime = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second, 0);
    const delta = targetWallTime - actualWallTime;

    if (delta === 0) {
      break;
    }

    utcTime += delta;
  }

  return new Date(utcTime);
}

function normalizeSettings(settings: BusinessClockSettings) {
  const startsAt = parseClock(settings.businessDayStartsAt ?? defaultSettings.startsAt);
  const endsAt = parseClock(settings.businessDayEndsAt ?? defaultSettings.endsAt);

  return {
    timezone: settings.businessTimezone || defaultSettings.timezone,
    startsAt,
    endsAt,
  };
}

export function getOperationalDayRange(referenceDate: Date, settings: BusinessClockSettings): OperationalDayRange {
  const normalized = normalizeSettings(settings);
  const zoned = getZonedParts(referenceDate, normalized.timezone);
  const localDate = {
    year: zoned.year,
    month: zoned.month,
    day: zoned.day,
  };
  const todayStart = zonedTimeToUtc(localDate, normalized.startsAt, normalized.timezone);
  const businessDate = referenceDate.getTime() < todayStart.getTime() ? addDays(localDate, -1) : localDate;
  const closesNextDay = clockMinutes(normalized.endsAt) <= clockMinutes(normalized.startsAt);
  const endDate = closesNextDay ? addDays(businessDate, 1) : businessDate;

  return {
    businessDate,
    businessDateKey: formatYmd(businessDate),
    start: zonedTimeToUtc(businessDate, normalized.startsAt, normalized.timezone),
    end: zonedTimeToUtc(endDate, normalized.endsAt, normalized.timezone),
    timezone: normalized.timezone,
    startsAt: formatClock(normalized.startsAt),
    endsAt: formatClock(normalized.endsAt),
  };
}

export function getOperationalDayRangeByBusinessDate(
  businessDate: Ymd,
  settings: BusinessClockSettings,
): OperationalDayRange {
  const normalized = normalizeSettings(settings);
  const closesNextDay = clockMinutes(normalized.endsAt) <= clockMinutes(normalized.startsAt);
  const endDate = closesNextDay ? addDays(businessDate, 1) : businessDate;

  return {
    businessDate,
    businessDateKey: formatYmd(businessDate),
    start: zonedTimeToUtc(businessDate, normalized.startsAt, normalized.timezone),
    end: zonedTimeToUtc(endDate, normalized.endsAt, normalized.timezone),
    timezone: normalized.timezone,
    startsAt: formatClock(normalized.startsAt),
    endsAt: formatClock(normalized.endsAt),
  };
}

export function getPreviousOperationalDayRange(range: OperationalDayRange, settings: BusinessClockSettings) {
  return getOperationalDayRangeByBusinessDate(addDays(range.businessDate, -1), settings);
}

export function getOperationalMonthRange(range: OperationalDayRange, settings: BusinessClockSettings) {
  const currentMonthStart = {
    year: range.businessDate.year,
    month: range.businessDate.month,
    day: 1,
  };
  const previousMonthStart = addMonths(currentMonthStart, -1);
  const nextMonthStart = addMonths(currentMonthStart, 1);

  return {
    monthStartBusinessDate: currentMonthStart,
    start: getOperationalDayRangeByBusinessDate(currentMonthStart, settings).start,
    end: getOperationalDayRangeByBusinessDate(nextMonthStart, settings).start,
    previousStart: getOperationalDayRangeByBusinessDate(previousMonthStart, settings).start,
  };
}

export function buildOperationalChartBuckets(
  currentRange: OperationalDayRange,
  days: number,
  settings: BusinessClockSettings,
) {
  return Array.from({ length: days }, (_, index) => {
    const businessDate = addDays(currentRange.businessDate, index - days + 1);
    return getOperationalDayRangeByBusinessDate(businessDate, settings);
  });
}

export function formatOperationalDateLabel(businessDateKey: string) {
  const [, month, day] = businessDateKey.split("-");

  return `${day}/${month}`;
}

export function toGoalDate(range: OperationalDayRange) {
  return new Date(Date.UTC(range.businessDate.year, range.businessDate.month - 1, range.businessDate.day, 0, 0, 0, 0));
}

export function getDaysInOperationalMonth(range: OperationalDayRange) {
  return new Date(Date.UTC(range.businessDate.year, range.businessDate.month, 0)).getUTCDate();
}
