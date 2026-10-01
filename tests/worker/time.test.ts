import { describe, expect, it } from "vitest";
import {
  BUSINESS_TIME_ZONE,
  businessDate,
  businessTime,
} from "../../shared/time";

describe("tempo operacional", () => {
  it("usa America/Sao_Paulo como regra única de produção", () => {
    expect(BUSINESS_TIME_ZONE).toBe("America/Sao_Paulo");
    expect(businessDate(new Date("2026-10-01T02:30:00.000Z"))).toBe(
      "2026-09-30",
    );
    expect(businessTime(new Date("2026-10-01T02:30:00.000Z"))).toBe(
      "23:30",
    );
    expect(businessDate(new Date("2026-10-01T03:01:00.000Z"))).toBe(
      "2026-10-01",
    );
    expect(businessTime(new Date("2026-10-01T03:01:00.000Z"))).toBe(
      "00:01",
    );
  });
});
