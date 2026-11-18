import { describe, expect, it } from "vitest";
import {
  getAveragePrice,
  getCurrentPriceRow,
  getDailyAveragePoints,
  getHourlyPricePoints,
  getRecentDayKeys,
  getRowsForDay,
  osloDateKey,
  priceIncludingVat,
  type PriceRow,
} from "./prices";

function priceRow(
  timeStart: string,
  timeEnd: string,
  powerPrice: number
): PriceRow {
  return {
    region: "NO1",
    time_start: timeStart,
    time_end: timeEnd,
    power_price: powerPrice,
  };
}

describe("price date and calculation helpers", () => {
  it("uses the Oslo calendar date for timestamps around UTC midnight", () => {
    expect(osloDateKey("2026-11-17T23:30:00Z")).toBe("2026-11-18");
  });

  it("returns exactly 30 day keys including today", () => {
    const keys = getRecentDayKeys("2026-11-18");

    expect(keys).toHaveLength(30);
    expect(keys[0]).toBe("2026-10-20");
    expect(keys[keys.length - 1]).toBe("2026-11-18");
  });

  it("applies VAT except for the NO4 price area", () => {
    expect(priceIncludingVat(2, "NO1")).toBe(2.5);
    expect(priceIncludingVat(2, "NO4")).toBe(2);
  });

  it("filters a day using Oslo time, not the timestamp's UTC date", () => {
    const osloLate = priceRow(
      "2026-11-17T23:30:00Z",
      "2026-11-18T00:30:00Z",
      1
    );
    const previousHour = priceRow(
      "2026-11-17T21:00:00Z",
      "2026-11-17T22:00:00Z",
      2
    );

    expect(getRowsForDay([osloLate, previousHour], "2026-11-18")).toEqual([
      osloLate,
    ]);
  });

  it("marks the current hour and includes VAT in chart points", () => {
    const rows = [
      priceRow(
        "2026-11-18T09:00:00+01:00",
        "2026-11-18T10:00:00+01:00",
        1
      ),
      priceRow(
        "2026-11-18T10:00:00+01:00",
        "2026-11-18T11:00:00+01:00",
        2
      ),
    ];

    const points = getHourlyPricePoints(
      rows,
      "NO1",
      Date.parse("2026-11-18T10:00:00+01:00")
    );

    expect(points.map((point) => point.isCurrentHour)).toEqual([false, true]);
    expect(points[1].price).toBe(2.5);
  });

  it("treats the start of a price interval as inclusive and its end as exclusive", () => {
    const first = priceRow(
      "2026-11-18T10:00:00+01:00",
      "2026-11-18T11:00:00+01:00",
      1
    );
    const next = priceRow(
      "2026-11-18T11:00:00+01:00",
      "2026-11-18T12:00:00+01:00",
      2
    );

    expect(
      getCurrentPriceRow([first, next], Date.parse(first.time_start))
    ).toBe(first);
    expect(
      getCurrentPriceRow([first, next], Date.parse(first.time_end))
    ).toBe(next);
  });

  it("calculates daily averages and preserves missing dates as null", () => {
    const points = getDailyAveragePoints(
      [
        priceRow(
          "2026-11-17T10:00:00+01:00",
          "2026-11-17T11:00:00+01:00",
          2
        ),
        priceRow(
          "2026-11-17T11:00:00+01:00",
          "2026-11-17T12:00:00+01:00",
          4
        ),
      ],
      ["2026-11-17", "2026-11-18"],
      "NO1"
    );

    expect(points[0].average).toBe(3.75);
    expect(points[1].average).toBeNull();
  });

  it("returns no average when there are no prices", () => {
    expect(getAveragePrice([], "NO1")).toBeNull();
  });
});
