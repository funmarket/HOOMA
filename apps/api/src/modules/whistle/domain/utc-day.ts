export interface WhistleUtcDayWindow {
  day: string;
  startsAt: Date;
  resetsAt: Date;
}

function dateOnlyUtc(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getWhistleUtcDayWindow(now: Date = new Date()): WhistleUtcDayWindow {
  const startsAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const resetsAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );

  return {
    day: dateOnlyUtc(startsAt),
    startsAt,
    resetsAt,
  };
}

export function whistleUtcDayWindowIsCurrent(window: WhistleUtcDayWindow, now: Date = new Date()) {
  return now.getTime() >= window.startsAt.getTime() && now.getTime() < window.resetsAt.getTime();
}
