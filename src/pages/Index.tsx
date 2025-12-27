import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { TopProducts } from "@/components/dashboard/TopProducts";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { DollarSign, ShoppingCart, Package, Users } from "lucide-react";

const Index = () => {
  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-bold">مرحباً، أحمد 👋</h1>
        <p className="text-muted-foreground mt-1">إليك نظرة عامة على أداء متجرك اليوم</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="إجمالي المبيعات"
          value="125,430 ر.س"
          change={{ value: 12.5, type: "increase" }}
          icon={DollarSign}
          variant="primary"
          delay={0}
        />
        <StatCard
          title="الطلبات الجديدة"
          value="48"
          change={{ value: 8.2, type: "increase" }}
          icon={ShoppingCart}
          delay={50}
        />
        <StatCard
          title="المنتجات النشطة"
          value="324"
          change={{ value: 3.1, type: "decrease" }}
          icon={Package}
          delay={100}
        />
        <StatCard
          title="العملاء"
          value="1,248"
          change={{ value: 15.3, type: "increase" }}
          icon={Users}
          variant="accent"
          delay={150}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <SalesChart />
        </div>
        <TopProducts />
      </div>

      {/* Recent Orders */}
      <RecentOrders />
    </DashboardLayout>
  );
};

export default Index;
