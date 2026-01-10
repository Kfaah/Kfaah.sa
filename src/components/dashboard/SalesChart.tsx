import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatNumber } from "@/lib/utils";

const data = [
  { name: "يناير", sales: 45000 },
  { name: "فبراير", sales: 52000 },
  { name: "مارس", sales: 48000 },
  { name: "أبريل", sales: 61000 },
  { name: "مايو", sales: 55000 },
  { name: "يونيو", sales: 72000 },
  { name: "يوليو", sales: 68000 },
  { name: "أغسطس", sales: 85000 },
  { name: "سبتمبر", sales: 78000 },
  { name: "أكتوبر", sales: 92000 },
  { name: "نوفمبر", sales: 88000 },
  { name: "ديسمبر", sales: 105000 },
];

export function SalesChart() {
  return (
    <div className="bg-card rounded-xl shadow-card p-6 animate-slide-up" style={{ animationDelay: "150ms" }}>
      <div className="mb-6">
        <h3 className="text-lg font-bold">تحليل المبيعات</h3>
        <p className="text-sm text-muted-foreground mt-1">نظرة عامة على المبيعات خلال العام</p>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(222, 47%, 20%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(222, 47%, 20%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "hsl(220, 9%, 46%)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "hsl(220, 9%, 46%)" }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(0, 0%, 100%)",
                border: "1px solid hsl(220, 13%, 91%)",
                borderRadius: "0.5rem",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
              formatter={(value: number) => [`${formatNumber(value)} ر.س`, "المبيعات"]}
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="hsl(222, 47%, 20%)"
              strokeWidth={2}
              fill="url(#salesGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
