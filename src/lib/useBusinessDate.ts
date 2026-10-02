import { useEffect, useState } from "react";
import { BUSINESS_TIME_ZONE, businessDate } from "../../shared/time";

function millisecondsUntilNextBusinessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value ?? 0);

  const elapsedSeconds =
    part("hour") * 60 * 60 + part("minute") * 60 + part("second");
  const remainingMilliseconds =
    (24 * 60 * 60 - elapsedSeconds - 1) * 1000 +
    (1000 - now.getMilliseconds());

  return Math.max(1000, remainingMilliseconds);
}

export function useBusinessDate() {
  const [today, setToday] = useState(businessDate);

  useEffect(() => {
    const syncBusinessDate = () => {
      const next = businessDate();
      setToday((current) => (current === next ? current : next));
    };

    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") syncBusinessDate();
    };

    const rolloverTimer = window.setTimeout(
      syncBusinessDate,
      millisecondsUntilNextBusinessDate() + 1500,
    );

    window.addEventListener("focus", syncBusinessDate);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      window.clearTimeout(rolloverTimer);
      window.removeEventListener("focus", syncBusinessDate);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [today]);

  return today;
}
