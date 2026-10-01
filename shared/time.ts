export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

function partsFor(
  now: Date,
  options: Intl.DateTimeFormatOptions,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    ...options,
  }).formatToParts(now);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

export function businessDate(now = new Date()): string {
  const values = partsFor(now, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return `${values.year}-${values.month}-${values.day}`;
}

export function businessTime(now = new Date()): string {
  const values = partsFor(now, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return `${values.hour}:${values.minute}`;
}
