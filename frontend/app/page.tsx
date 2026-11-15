"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/lib/supabase";

type PriceRow = {
  region: string;
  time_start: string;
  time_end: string;
  power_price: number;
};

function formatHour(iso: string) {
  return new Date(iso).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function HomePage() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("power_prices")
        .select("region, time_start, time_end, power_price")
        .eq("region", "NO1")
        .order("time_start", { ascending: true });

      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        setRows((data as PriceRow[]) ?? []);
      }

      setLoading(false);
    }

    load();
  }, []);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        label: `${formatDay(r.time_start)} ${formatHour(r.time_start)}`,
        price: Number(r.power_price),
      })),
    [rows]
  );

  const stats = useMemo(() => {
    if (rows.length === 0) {
      return { avg: null, min: null, max: null, latest: null };
    }
    const values = rows.map((r) => Number(r.power_price));
    const sum = values.reduce((a, b) => a + b, 0);
    const latest = rows[rows.length - 1];
    return {
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      latest,
    };
  }, [rows]);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ marginBottom: 8 }}>Strømpriser — NO1</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Data hentes fra Supabase. Prisene oppdateres daglig automatisk.
      </p>

      {loading && <p>Laster priser…</p>}
      {error && (
        <p style={{ color: "crimson" }}>
          Kunne ikke hente data: {error}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p>Ingen priser i databasen ennå.</p>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
              margin: "1.5rem 0",
            }}
          >
            <StatCard
              title="Siste pris"
              value={
                stats.latest
                  ? `${Number(stats.latest.power_price).toFixed(2)} kr/kWh`
                  : "—"
              }
            />
            <StatCard
              title="Snitt"
              value={stats.avg !== null ? `${stats.avg.toFixed(2)} kr/kWh` : "—"}
            />
            <StatCard
              title="Lavest"
              value={stats.min !== null ? `${stats.min.toFixed(2)} kr/kWh` : "—"}
            />
            <StatCard
              title="Høyest"
              value={stats.max !== null ? `${stats.max.toFixed(2)} kr/kWh` : "—"}
            />
          </section>

          <section
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Pris over tid</h2>
            <div style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    minTickGap={30}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    unit=" kr"
                    domain={["auto", "auto"]}
                  />
                 <Tooltip
                    formatter={(value) => {
                      const num = typeof value === "number" ? value : Number(value);
                      return [`${num.toFixed(3)} kr/kWh`, "Pris"];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <h2>Siste rader</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Tid</th>
                    <th style={th}>Region</th>
                    <th style={th}>Pris (kr/kWh)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(-12).reverse().map((r) => (
                    <tr key={`${r.region}-${r.time_start}`}>
                      <td style={td}>
                        {formatDay(r.time_start)} {formatHour(r.time_start)}
                      </td>
                      <td style={td}>{r.region}</td>
                      <td style={td}>{Number(r.power_price).toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        padding: 14,
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: 13, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  padding: "8px 6px",
  fontSize: 14,
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #f0f0f0",
  padding: "8px 6px",
  fontSize: 14,
};