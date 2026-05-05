"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface ScoreDistributionChartProps {
  data: { range: string; count: number }[]
}

export function ScoreDistributionChart({ data }: ScoreDistributionChartProps) {
  // Handle empty data state
  if (!data || data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No score data available. More evaluation sessions needed for visualization.</p>
      </div>
    )
  }

  // Color bars based on score range (red for low, yellow for medium, green for high)
  const getBarColor = (range: string): string => {
    if (range.startsWith("0.0") || range.startsWith("0.2")) {
      return "#ef4444" // red-500
    } else if (range.startsWith("0.4") || range.startsWith("0.6")) {
      return "#f59e0b" // amber-500
    } else {
      return "#10b981" // green-500
    }
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="range"
          label={{ value: "Score Range", position: "insideBottom", offset: -5 }}
          tick={{ fill: "#6b7280" }}
        />
        <YAxis
          label={{ value: "Count", angle: -90, position: "insideLeft" }}
          tick={{ fill: "#6b7280" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "8px 12px",
          }}
          labelStyle={{ color: "#111827", fontWeight: 600 }}
          itemStyle={{ color: "#6b7280" }}
          formatter={(value: number | undefined) =>
            value !== undefined ? [`${value} sessions`, "Count"] : ["0 sessions", "Count"]
          }
        />
        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.range)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
