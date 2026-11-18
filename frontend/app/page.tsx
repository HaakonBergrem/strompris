"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from "recharts";
import { supabase } from "@/lib/supabase";

// Map the API's region codes to names shown in the selector and dashboard
const REGIONS = [
  { code: "NO1", name: "Øst-Norge" },
  { code: "NO2", name: "Sør-Norge" },
  { code: "NO3", name: "Midt-Norge" },
  { code: "NO4", name: "Nord-Norge" },
  { code: "NO5", name: "Vest-Norge" },
] as const;

// Derive the allowed region codes from the configured region list
type RegionCode = (typeof REGIONS)[number]["code"];

// Shape of each price record selected from Supabase
type PriceRow = {
  region: string;
  time_start: string;
  time_end: string;
  power_price: number;
};

// Convert a Date or ISO string to a YYYY-MM-DD key in the Oslo time zone
function osloDateKey(value: Date | string) {
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

// Format an ISO timestamp to a 24-hour clock in the Oslo time zone
function formatHour(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// Format a YYYY-MM-DD key to a short weekday and date in the Oslo time zone
function formatDay(dayKey: string) {
  // Use midday UTC to keep date-only values on the intended Oslo calendar day
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${dayKey}T12:00:00Z`));
}

// Format a number to a Norwegian price string with a fixed number of decimals
function formatPrice(value: number, decimals = 3) {
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Adjust the API price to include VAT where applicable
function priceIncludingVat(price: number, region: RegionCode) {
  // The API price is VAT-exclusive except in the NO4 price area
  return region === "NO4" ? price : price * 1.25;
}

export default function HomePage() {
  const [region, setRegion] = useState<RegionCode>("NO1");
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  const [rows, setRows] = useState<PriceRow[]>([]);
  const regionPickerRef = useRef<HTMLDivElement>(null);
  const regionTriggerRef = useRef<HTMLButtonElement>(null);
  const regionMenuRef = useRef<HTMLDivElement>(null);
  // A local clock lets the current-hour price update without reloading the page
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNow(Date.now());
    // Update the local clock every 30 seconds to keep the current price accurate
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Close the region menu when focus moves outside it or Escape is pressed.
  useEffect(() => {
    if (!regionMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !regionPickerRef.current?.contains(event.target)
      ) {
        setRegionMenuOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setRegionMenuOpen(false);
        regionTriggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    regionMenuRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')
      ?.focus();

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [regionMenuOpen]);

  // Reload prices when the selected region changes; ignore stale responses
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // Query the last 32 days of prices to ensure we have a full 30-day history
      const cutoff = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error: queryError } = await supabase
        .from("power_prices")
        .select("region, time_start, time_end, power_price")
        .eq("region", region)
        .gte("time_start", cutoff)
        .order("time_start", { ascending: true });

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setRows([]);
      } else {
        setRows((data as PriceRow[]) ?? []);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [region]);

  const todayKey = osloDateKey(new Date(now));
  // Generate the 30 calendar dates in ascending order
  const dayKeys = useMemo(() => {
    const today = new Date(`${todayKey}T00:00:00Z`);
    return Array.from({ length: 30 }, (_, index) => {
      const day = new Date(today);
      day.setUTCDate(today.getUTCDate() - (29 - index));
      return day.toISOString().slice(0, 10);
    });
  }, [todayKey]);

  // Keep only records that belong to today in the Oslo time zone
  const todayRows = useMemo(
    () => rows.filter((row) => osloDateKey(row.time_start) === todayKey),
    [rows, todayKey]
  );

  // Prepare today's hourly series with VAT-adjusted values for display
  const todayChartData = useMemo(
    () =>
      todayRows.map((row) => ({
        label: formatHour(row.time_start),
        price: priceIncludingVat(Number(row.power_price), region),
        isCurrentHour:
          Date.parse(row.time_start) <= now && Date.parse(row.time_end) > now,
      })),
    [now, region, todayRows]
  );

  // Group hourly records by Oslo date and calculate one average per day
  const averageChartData = useMemo(() => {
    const pricesByDay = new Map<string, number[]>();
    for (const row of rows) {
      const key = osloDateKey(row.time_start);
      if (!dayKeys.includes(key)) continue;
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
  }, [dayKeys, region, rows]);

  // Find the price interval that contains the current time
  const currentRow = useMemo(
    () =>
      rows.find(
        (row) =>
          Date.parse(row.time_start) <= now && Date.parse(row.time_end) > now
      ),
    [now, rows]
  );

  // Calculate today's average from the hourly records currently available
  const todayAverage =
    todayRows.length > 0
      ? priceIncludingVat(
          todayRows.reduce((sum, row) => sum + Number(row.power_price), 0) /
            todayRows.length,
          region
        )
      : null;

  const selectedRegion = REGIONS.find((item) => item.code === region);

  // Handle keyboard navigation within the region menu
  function moveRegionMenuFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

    const options = Array.from(
      regionMenuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]'
      ) ?? []
    );
    const activeIndex = options.findIndex(
      (option) => option === document.activeElement
    );
    if (options.length === 0) return;

    event.preventDefault();
    if (event.key === "Home") {
      options[0].focus();
    } else if (event.key === "End") {
      options[options.length - 1].focus();
    } else {
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        activeIndex < 0
          ? 0
          : (activeIndex + direction + options.length) % options.length;
      options[nextIndex].focus();
    }
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Strømblikk hjem">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>STRØMBLIKK</span>
        </a>
        <div
          className="region-picker"
          ref={regionPickerRef}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (
              !(nextTarget instanceof Node) ||
              !event.currentTarget.contains(nextTarget)
            ) {
              setRegionMenuOpen(false);
            }
          }}
        >
          <button
            ref={regionTriggerRef}
            className="region-trigger"
            type="button"
            aria-haspopup="menu"
            aria-expanded={regionMenuOpen}
            aria-controls="region-menu"
            onClick={() => setRegionMenuOpen((open) => !open)}
          >
            <span className="region-picker-label">Prisområde</span>
            <span className="region-trigger-value">
              <span className="region-code-chip">{region}</span>
              <span>{selectedRegion?.name ?? region}</span>
            </span>
            <svg
              className={`region-chevron${regionMenuOpen ? " is-open" : ""}`}
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <path d="m4 6 4 4 4-4" />
            </svg>
          </button>
          {regionMenuOpen && (
            <div
              ref={regionMenuRef}
              className="region-menu"
              id="region-menu"
              role="menu"
              aria-label="Velg prisområde"
              onKeyDown={moveRegionMenuFocus}
            >
              <p className="region-menu-heading">VELG PRISOMRÅDE</p>
              {REGIONS.map((item) => {
                const isSelected = item.code === region;
                return (
                  <button
                    className={`region-option${isSelected ? " is-selected" : ""}`}
                    key={item.code}
                    type="button"
                    tabIndex={-1}
                    role="menuitemradio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setRegion(item.code);
                      setRegionMenuOpen(false);
                      regionTriggerRef.current?.focus();
                    }}
                  >
                    <span className="region-option-code">{item.code}</span>
                    <span className="region-option-name">{item.name}</span>
                    {isSelected && (
                      <svg
                        className="region-option-check"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                      >
                        <path d="m3.5 8.5 3 3 6-7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      <section className="page-intro">
        <h1>Oversikt over strømprisen</h1>
        <p className="intro-copy">
          Følg dagens timepriser og se hvordan prisnivået har utviklet seg den
          siste måneden.
        </p>
      </section>

      <section className="summary-grid" aria-label="Pris akkurat nå">
        <div className="current-card">
          <div className="current-card-top">
            <div>
              <p className="card-kicker">PRIS AKKURAT NÅ</p>
              <h2>{selectedRegion?.name ?? region}</h2>
            </div>
          </div>
          <div className="current-price">
            {loading
              ? "—"
              : currentRow
                ? formatPrice(
                    priceIncludingVat(Number(currentRow.power_price), region),
                    3
                  )
                : "—"}
            <span>kr/kWh</span>
          </div>
          <p className="current-caption">
            {currentRow
              ? `Timepris ${formatHour(currentRow.time_start)}–${formatHour(currentRow.time_end)}`
              : "Ingen pris tilgjengelig for inneværende time"}
          </p>
        </div>

        <div className="today-summary">
          <p className="card-kicker">DAGENS SNITT</p>
          <div className="today-average">
            {loading || todayAverage === null
              ? "—"
              : formatPrice(todayAverage, 3)}
            <span>kr/kWh</span>
          </div>
          <p className="muted-copy">
            {todayRows.length > 0
              ? `${todayRows.length} pristimer registrert i dag`
              : "Venter på dagens priser"}
          </p>
        </div>
      </section>

      {error && (
        <div className="message error-message" role="alert">
          Kunne ikke hente priser: {error}
        </div>
      )}

      {/* Show the selected region's hourly prices and 30-day daily averages. */}
      <section className="charts-grid" aria-label="Prisgrafer">
        <ChartCard
          title="I dag, time for time"
          description=""
          loading={loading}
          empty={!loading && todayChartData.length === 0}
          emptyMessage="Ingen priser for i dag ennå."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={todayChartData}
              margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
            >
              <CartesianGrid stroke="#e9eef5" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#8290a5", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "#8290a5", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={(value: number) => formatPrice(value, 2)}
              />
              <Tooltip
                formatter={(value) => [
                  `${formatPrice(Number(value))} kr/kWh`,
                  "Timepris",
                ]}
                labelFormatter={(label) => `Kl. ${label}`}
                contentStyle={tooltipStyle}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#167d73"
                strokeWidth={3}
                dot={TodayPriceDot}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Døgnsnitt · siste 30 dager"
          description=""
          loading={loading}
          empty={!loading && rows.length === 0}
          emptyMessage="Ingen historiske priser for dette området ennå."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={averageChartData}
              margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
            >
              <CartesianGrid stroke="#e9eef5" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#8290a5", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={18}
              />
              <YAxis
                tick={{ fill: "#8290a5", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={(value: number) => formatPrice(value, 2)}
              />
              <Tooltip
                formatter={(value) => [
                  `${formatPrice(Number(value))} kr/kWh`,
                  "Døgnsnitt",
                ]}
                contentStyle={tooltipStyle}
              />
              <Line
                type="monotone"
                dataKey="average"
                stroke="#4e72c8"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <footer className="page-footer">
        <span>Strømpriser hentet fra hvakosterstrommen.no</span>
        <span>Oppdatert daglig · inkl. mva der det gjelder</span>
      </footer>
    </main>
  );
}

// Show a larger dot for the current hour in today's hourly chart
function TodayPriceDot({ cx, cy, payload }: DotItemDotProps) {
  if (typeof cx !== "number" || typeof cy !== "number") return null;

  const isCurrentHour =
    typeof payload === "object" &&
    payload !== null &&
    "isCurrentHour" in payload &&
    payload.isCurrentHour === true;

  return (
    <g aria-hidden="true">
      {isCurrentHour && (
        <circle cx={cx} cy={cy} r={9} fill="#167d73" opacity={0.2} />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={isCurrentHour ? 5 : 2.5}
        fill="#167d73"
        stroke={isCurrentHour ? "#fff" : "none"}
        strokeWidth={isCurrentHour ? 2 : 0}
      />
    </g>
  );
}

// Share the card layout and loading/empty states between both charts.
function ChartCard({
  title,
  description,
  loading,
  empty,
  emptyMessage,
  children,
}: {
  title: string;
  description: string;
  loading: boolean;
  empty: boolean;
  emptyMessage: string;
  children: ReactNode;
}) {
  return (
    <article className="chart-card">
      <div className="chart-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="chart-area">
        {loading ? (
          <div className="chart-message">Henter priser…</div>
        ) : empty ? (
          <div className="chart-message">{emptyMessage}</div>
        ) : (
          children
        )}
      </div>
    </article>
  );
}

// Keep tooltip styling consistent across the charts.
const tooltipStyle = {
  border: "1px solid #e6ebf2",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(20, 35, 60, 0.1)",
};
