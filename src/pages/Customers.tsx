import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Mail, Phone, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  orders: number;
  totalSpent: number;
  status: "active" | "inactive";
  joinDate: string;
}

const customers: Customer[] = [
  { id: "1", name: "محمد أحمد", email: "mohamed@email.com", phone: "+966 50 123 4567", orders: 12, totalSpent: 45600, status: "active", joinDate: "2023-05-15" },
  { id: "2", name: "سارة علي", email: "sara@email.com", phone: "+966 55 234 5678", orders: 8, totalSpent: 32400, status: "active", joinDate: "2023-07-22" },
  { id: "3", name: "خالد عمر", email: "khaled@email.com", phone: "+966 54 345 6789", orders: 3, totalSpent: 8750, status: "inactive", joinDate: "2023-09-10" },
  { id: "4", name: "فاطمة حسن", email: "fatima@email.com", phone: "+966 56 456 7890", orders: 15, totalSpent: 67200, status: "active", joinDate: "2023-03-08" },
  { id: "5", name: "عمر يوسف", email: "omar@email.com", phone: "+966 59 567 8901", orders: 6, totalSpent: 21300, status: "active", joinDate: "2023-11-01" },
];

const Customers = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCustomers = customers.filter((customer) =>
    customer.name.includes(searchQuery) || customer.email.includes(searchQuery)
  );

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">العملاء</h1>
          <p className="text-muted-foreground mt-1">إدارة قاعدة عملاء متجرك</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 animate-slide-up">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن عميل..."
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

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((customer, index) => (
          <div
            key={customer.id}
            className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-slide-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                  {customer.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold">{customer.name}</h3>
                  <Badge
                    className={cn(
                      "text-xs",
                      customer.status === "active"
                        ? "bg-success/10 text-success"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {customer.status === "active" ? "نشط" : "غير نشط"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                {customer.email}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" />
                {customer.phone}
              </div>
            </div>

            <div className="pt-4 border-t border-border grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-sm">
                  <ShoppingBag className="w-4 h-4" />
                  الطلبات
                </div>
                <p className="font-bold text-lg">{customer.orders}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">إجمالي الإنفاق</p>
                <p className="font-bold text-lg">{customer.totalSpent.toLocaleString()} ر.س</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default Customers;
