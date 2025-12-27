import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Order {
  id: string;
  customer: string;
  product: string;
  amount: number;
  status: "pending" | "processing" | "completed" | "cancelled";
  date: string;
}

const orders: Order[] = [
  { id: "#1234", customer: "محمد أحمد", product: "آيفون 15 برو", amount: 4500, status: "completed", date: "اليوم" },
  { id: "#1235", customer: "سارة علي", product: "ماك بوك برو", amount: 8200, status: "processing", date: "اليوم" },
  { id: "#1236", customer: "خالد عمر", product: "سماعات آبل", amount: 950, status: "pending", date: "أمس" },
  { id: "#1237", customer: "فاطمة حسن", product: "آيباد برو", amount: 3200, status: "completed", date: "أمس" },
  { id: "#1238", customer: "عمر يوسف", product: "ساعة آبل", amount: 1800, status: "cancelled", date: "قبل يومين" },
];

const statusConfig = {
  pending: { label: "قيد الانتظار", variant: "warning" as const },
  processing: { label: "قيد المعالجة", variant: "default" as const },
  completed: { label: "مكتمل", variant: "success" as const },
  cancelled: { label: "ملغي", variant: "destructive" as const },
};

export function RecentOrders() {
  return (
    <div className="bg-card rounded-xl shadow-card animate-slide-up" style={{ animationDelay: "200ms" }}>
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-bold">أحدث الطلبات</h3>
        <p className="text-sm text-muted-foreground mt-1">آخر 5 طلبات تم استلامها</p>
      </div>
      <div className="divide-y divide-border">
        {orders.map((order, index) => (
          <div
            key={order.id}
            className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
            style={{ animationDelay: `${300 + index * 50}ms` }}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {order.customer.charAt(0)}
              </div>
              <div>
                <p className="font-semibold">{order.customer}</p>
                <p className="text-sm text-muted-foreground">{order.product}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-left">
                <p className="font-bold">{order.amount.toLocaleString()} ر.س</p>
                <p className="text-xs text-muted-foreground">{order.date}</p>
              </div>
              <Badge
                className={cn(
                  "font-medium",
                  statusConfig[order.status].variant === "success" && "bg-success/10 text-success hover:bg-success/20",
                  statusConfig[order.status].variant === "warning" && "bg-warning/10 text-warning hover:bg-warning/20",
                  statusConfig[order.status].variant === "destructive" && "bg-destructive/10 text-destructive hover:bg-destructive/20",
                  statusConfig[order.status].variant === "default" && "bg-primary/10 text-primary hover:bg-primary/20"
                )}
              >
                {statusConfig[order.status].label}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
