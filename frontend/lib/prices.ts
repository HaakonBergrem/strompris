export const REGIONS = [
  { code: "NO1", name: "Øst-Norge" },
  { code: "NO2", name: "Sør-Norge" },
  { code: "NO3", name: "Midt-Norge" },
  { code: "NO4", name: "Nord-Norge" },
  { code: "NO5", name: "Vest-Norge" },
] as const;

export type RegionCode = (typeof REGIONS)[number]["code"];

export type PriceRow = {
  region: string;
  time_start: string;
  time_end: string;
  power_price: number;
};

export type HourlyPricePoint = {
  label: string;
  price: number;
  isCurrentHour: boolean;
};

export type DailyAveragePoint = {
  label: string;
  average: number | null;
};

export function osloDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatHour(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDay(dayKey: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${dayKey}T12:00:00Z`));
}

export function formatPrice(value: number, decimals = 3) {
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function priceIncludingVat(price: number, region: RegionCode) {
  return region === "NO4" ? price : price * 1.25;
}

export function getRecentDayKeys(todayKey: string, count = 30) {
  const today = new Date(`${todayKey}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - (count - 1 - index));
    return day.toISOString().slice(0, 10);
  });
}

export function getRowsForDay(rows: PriceRow[], dayKey: string) {
  return rows.filter((row) => osloDateKey(row.time_start) === dayKey);
}

export function getHourlyPricePoints(
  rows: PriceRow[],
  region: RegionCode,
  now: number
): HourlyPricePoint[] {
  return rows.map((row) => ({
    label: formatHour(row.time_start),
    price: priceIncludingVat(Number(row.power_price), region),
    isCurrentHour:
      Date.parse(row.time_start) <= now && Date.parse(row.time_end) > now,
  }));
}

export function getDailyAveragePoints(
  rows: PriceRow[],
  dayKeys: string[],
  region: RegionCode
): DailyAveragePoint[] {
  const dayKeySet = new Set(dayKeys);
  const pricesByDay = new Map<string, number[]>();

  for (const row of rows) {
    const key = osloDateKey(row.time_start);
    if (!dayKeySet.has(key)) continue;
    const prices = pricesByDay.get(key) ?? [];
    prices.push(Number(row.power_price));
    pricesByDay.set(key, prices);
  }

  return dayKeys.map((key) => {
    const prices = pricesByDay.get(key) ?? [];
    const average =
      prices.length > 0
        ? priceIncludingVat(
            prices.reduce((sum, price) => sum + price, 0) / prices.length,
            region
          )
        : null;
    return { label: formatDay(key), average };
  });
}

export function getCurrentPriceRow(rows: PriceRow[], now: number) {
  return rows.find(
    (row) =>
      Date.parse(row.time_start) <= now && Date.parse(row.time_end) > now
  );
}

export function getAveragePrice(rows: PriceRow[], region: RegionCode) {
  if (rows.length === 0) return null;

  const average =
    rows.reduce((sum, row) => sum + Number(row.power_price), 0) / rows.length;
  return priceIncludingVat(average, region);
}
