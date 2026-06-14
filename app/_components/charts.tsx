"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const CHART_COLORS = ["#f97316", "#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"];

export function DonutChart({
  data,
  centerValue,
  centerLabel,
}: {
  data: { name: string; value: number; color?: string }[];
  centerValue?: string;
  centerLabel?: string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="relative h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={total === 0 ? [{ name: "none", value: 1 }] : data}
            dataKey="value"
            innerRadius={58}
            outerRadius={80}
            paddingAngle={total === 0 ? 0 : 3}
            stroke="none"
          >
            {(total === 0 ? [{ color: "#e2e8f0" }] : data).map((d, i) => (
              <Cell key={i} fill={(d as { color?: string }).color ?? CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          {total > 0 && <Tooltip />}
        </PieChart>
      </ResponsiveContainer>
      {(centerValue || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900">{centerValue}</span>
          {centerLabel && <span className="text-xs text-slate-400">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

export function Legend({ data }: { data: { name: string; value: number; color?: string }[] }) {
  return (
    <ul className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
      {data.map((d, i) => (
        <li key={i} className="flex items-center gap-1.5 text-slate-500">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }}
          />
          {d.name} <span className="font-medium text-slate-700">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function TrendLineChart({
  data,
  color = "#f97316",
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef1f5" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" width={36} />
          <Tooltip formatter={(value: number) => [`${value}%`, "Attendance"]} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBar({
  data,
  color = "#f97316",
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef1f5" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
          <Tooltip cursor={{ fill: "#f8fafc" }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={color} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
