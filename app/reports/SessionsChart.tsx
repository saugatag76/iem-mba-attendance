"use client";

import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";

type Entry = {
  subject: string;
  code: string;
  sessions: number;
  offeringId: string;
  qs: string;
};

const PRIMARY = "var(--color-primary, #2f7eda)";

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: Entry }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{d.subject}</p>
      <p className="text-muted-foreground">{d.code}</p>
      <p className="mt-1 font-bold text-primary">{d.sessions} {d.sessions === 1 ? "class" : "classes"} conducted</p>
      <p className="mt-0.5 text-muted-foreground/70">Click to view register →</p>
    </div>
  );
}

export function SessionsChart({ data }: { data: Entry[] }) {
  const router = useRouter();
  const barHeight = 44;
  const height = Math.max(200, data.length * barHeight + 40);
  const maxSessions = Math.max(...data.map((d) => d.sessions), 1);

  function handleClick(entry: Entry) {
    router.push(`/reports/offering/${entry.offeringId}${entry.qs}`);
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 48, left: 8, bottom: 8 }}
        barCategoryGap="30%"
        style={{ cursor: "pointer" }}
      >
        <XAxis
          type="number"
          domain={[0, maxSessions + 1]}
          tickCount={Math.min(maxSessions + 2, 8)}
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground, #9fa0b5)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="code"
          width={68}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground, #9fa0b5)", fontFamily: "monospace" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-muted, #edeff3)", radius: 6 }} />
        <Bar
          dataKey="sessions"
          radius={[0, 6, 6, 0]}
          maxBarSize={24}
          onClick={(data: unknown) => handleClick(data as Entry)}
        >
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={PRIMARY}
              fillOpacity={0.85 - (i / data.length) * 0.3}
            />
          ))}
          <LabelList
            dataKey="sessions"
            position="right"
            style={{ fontSize: 12, fontWeight: 600, fill: "var(--color-foreground, #0f1117)" }}
            formatter={(v: unknown) => `${v}`}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
