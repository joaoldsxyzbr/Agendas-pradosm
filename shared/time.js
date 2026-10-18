const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
function partsFor(now, options) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    ...options
  }).formatToParts(now);
  return Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
}
function businessDate(now = /* @__PURE__ */ new Date()) {
  const values = partsFor(now, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return `${values.year}-${values.month}-${values.day}`;
}
function businessTime(now = /* @__PURE__ */ new Date()) {
  const values = partsFor(now, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  return `${values.hour}:${values.minute}`;
}
export {
  BUSINESS_TIME_ZONE,
  businessDate,
  businessTime
};