import { BUSINESS_TIME_ZONE, businessDate } from "../../shared/time.js";

export function millisecondsUntilNextBusinessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE, hour: "2-digit", minute: "2-digit",
    second: "2-digit", hourCycle: "h23"
  }).formatToParts(now);
  const part = type => Number(parts.find(entry => entry.type === type)?.value ?? 0);
  const elapsed = part("hour") * 3600 + part("minute") * 60 + part("second");
  const remaining = (86400 - elapsed - 1) * 1000 + (1000 - now.getMilliseconds());
  return Math.max(1000, remaining);
}

// Equivale ao useBusinessDate da main sem React.
export function createBusinessDateMonitor({
  now = () => new Date(), timers = window, doc = document,
  onChange = () => {}
} = {}) {
  let active = false, timeout = null;
  let today = businessDate(now());
  const schedule = () => {
    if (timeout !== null) timers.clearTimeout(timeout);
    timeout = timers.setTimeout(sync, millisecondsUntilNextBusinessDate(now()) + 1500);
  };
  const sync = () => {
    if (!active) return;
    const next = businessDate(now());
    if (next !== today) {
      today = next;
      onChange(next);
    }
    schedule();
  };
  const visible = () => {
    if (doc.visibilityState === "visible") sync();
  };
  return {
    get today() { return today; },
    start() {
      if (active) return;
      active = true;
      today = businessDate(now());
      timers.addEventListener("focus", sync);
      doc.addEventListener("visibilitychange", visible);
      schedule();
    },
    stop() {
      if (!active) return;
      active = false;
      if (timeout !== null) timers.clearTimeout(timeout);
      timeout = null;
      timers.removeEventListener("focus", sync);
      doc.removeEventListener("visibilitychange", visible);
    }
  };
}
