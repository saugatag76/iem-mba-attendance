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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

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
            nameKey="name"
            innerRadius={58}
            outerRadius={80}
            paddingAngle={total === 0 ? 0 : 3}
            stroke="none"
          >
            {(total === 0 ? [{ color: "var(--muted)" }] : data).map((d, i) => (
              <Cell key={i} fill={(d as { color?: string }).color ?? CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          {total > 0 && (
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      {(centerValue || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-foreground">{centerValue}</span>
          {centerLabel && <span className="text-xs text-muted-foreground">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

export function Legend({ data }: { data: { name: string; value: number; color?: string }[] }) {
  return (
    <ul className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
      {data.map((d, i) => (
        <li key={i} className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }}
          />
          {d.name} <span className="font-medium tabular-nums text-foreground">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}

const trendConfig = {
  value: { label: "Attendance", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function TrendLineChart({
  data,
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  return (
    <ChartContainer config={trendConfig} className="h-56 w-full">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={36} fontSize={12} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ChartContainer>
  );
}

const barConfig = {
  value: { label: "Value", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function SimpleBar({
  data,
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  return (
    <ChartContainer config={barConfig} className="h-56 w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--color-value)" maxBarSize={38} />
      </BarChart>
    </ChartContainer>
  );
}
