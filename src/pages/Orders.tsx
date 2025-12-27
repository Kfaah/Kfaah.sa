import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, MoreVertical, Eye, Truck, XCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Order {
  id: string;
  customer: string;
  email: string;
  products: number;
  total: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  date: string;
  paymentMethod: string;
}

const orders: Order[] = [
  { id: "#ORD-1234", customer: "محمد أحمد", email: "mohamed@email.com", products: 3, total: 5450, status: "pending", date: "2024-01-15", paymentMethod: "بطاقة ائتمان" },
  { id: "#ORD-1235", customer: "سارة علي", email: "sara@email.com", products: 1, total: 8200, status: "processing", date: "2024-01-15", paymentMethod: "Apple Pay" },
  { id: "#ORD-1236", customer: "خالد عمر", email: "khaled@email.com", products: 2, total: 2750, status: "shipped", date: "2024-01-14", paymentMethod: "تحويل بنكي" },
  { id: "#ORD-1237", customer: "فاطمة حسن", email: "fatima@email.com", products: 4, total: 6800, status: "delivered", date: "2024-01-14", paymentMethod: "بطاقة ائتمان" },
  { id: "#ORD-1238", customer: "عمر يوسف", email: "omar@email.com", products: 1, total: 1800, status: "cancelled", date: "2024-01-13", paymentMethod: "STC Pay" },
  { id: "#ORD-1239", customer: "نورة سعد", email: "noura@email.com", products: 2, total: 3400, status: "delivered", date: "2024-01-13", paymentMethod: "بطاقة ائتمان" },
];

const statusConfig = {
  pending: { label: "قيد الانتظار", className: "bg-warning/10 text-warning" },
  processing: { label: "قيد المعالجة", className: "bg-primary/10 text-primary" },
  shipped: { label: "تم الشحن", className: "bg-accent/20 text-accent-foreground" },
  delivered: { label: "تم التسليم", className: "bg-success/10 text-success" },
  cancelled: { label: "ملغي", className: "bg-destructive/10 text-destructive" },
};

const Orders = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrders = orders.filter((order) =>
    order.id.includes(searchQuery) || order.customer.includes(searchQuery)
  );

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">الطلبات</h1>
          <p className="text-muted-foreground mt-1">متابعة وإدارة طلبات العملاء</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "جميع الطلبات", value: 156, color: "bg-primary" },
          { label: "قيد المعالجة", value: 23, color: "bg-warning" },
          { label: "تم الشحن", value: 45, color: "bg-accent" },
          { label: "تم التسليم", value: 88, color: "bg-success" },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="bg-card rounded-xl p-4 shadow-card animate-slide-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className={cn("w-2 h-8 rounded-full", stat.color)} />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن طلب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          فلترة
        </Button>
      </div>

      {/* Orders Table */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden animate-slide-up" style={{ animationDelay: "250ms" }}>
        <table className="w-full">
          <thead className="bg-secondary/50 border-b border-border">
            <tr>
              <th className="text-right p-4 font-semibold text-sm">رقم الطلب</th>
              <th className="text-right p-4 font-semibold text-sm">العميل</th>
              <th className="text-right p-4 font-semibold text-sm">المنتجات</th>
              <th className="text-right p-4 font-semibold text-sm">الإجمالي</th>
              <th className="text-right p-4 font-semibold text-sm">طريقة الدفع</th>
              <th className="text-right p-4 font-semibold text-sm">الحالة</th>
              <th className="text-right p-4 font-semibold text-sm">التاريخ</th>
              <th className="text-center p-4 font-semibold text-sm">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredOrders.map((order, index) => (
              <tr
                key={order.id}
                className="hover:bg-secondary/30 transition-colors animate-fade-in"
                style={{ animationDelay: `${300 + index * 50}ms` }}
              >
                <td className="p-4 font-semibold text-primary">{order.id}</td>
                <td className="p-4">
                  <div>
                    <p className="font-semibold">{order.customer}</p>
                    <p className="text-sm text-muted-foreground">{order.email}</p>
                  </div>
                </td>
                <td className="p-4">{order.products} منتجات</td>
                <td className="p-4 font-semibold">{order.total.toLocaleString()} ر.س</td>
                <td className="p-4 text-muted-foreground">{order.paymentMethod}</td>
                <td className="p-4">
                  <Badge className={cn("font-medium", statusConfig[order.status].className)}>
                    {statusConfig[order.status].label}
                  </Badge>
                </td>
                <td className="p-4 text-muted-foreground">{order.date}</td>
                <td className="p-4">
                  <div className="flex items-center justify-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2">
                          <Eye className="w-4 h-4" />
                          عرض التفاصيل
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2">
                          <Truck className="w-4 h-4" />
                          تحديث الشحن
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-destructive">
                          <XCircle className="w-4 h-4" />
                          إلغاء الطلب
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
};

export default Orders;
