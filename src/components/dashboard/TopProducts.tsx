import { TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface Product {
  name: string;
  sales: number;
  revenue: number;
  growth: number;
}

const products: Product[] = [
  { name: "آيفون 15 برو ماكس", sales: 156, revenue: 702000, growth: 23 },
  { name: "ماك بوك برو M3", sales: 89, revenue: 729800, growth: 18 },
  { name: "آيباد برو 12.9", sales: 124, revenue: 396800, growth: 12 },
  { name: "سماعات AirPods Pro", sales: 234, revenue: 222300, growth: 31 },
  { name: "ساعة آبل Ultra 2", sales: 67, revenue: 120600, growth: 8 },
];

export function TopProducts() {
  const maxSales = Math.max(...products.map((p) => p.sales));

  return (
    <div className="bg-card rounded-xl shadow-card animate-slide-up" style={{ animationDelay: "250ms" }}>
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-bold">المنتجات الأكثر مبيعاً</h3>
        <p className="text-sm text-muted-foreground mt-1">أعلى 5 منتجات هذا الشهر</p>
      </div>
      <div className="p-6 space-y-5">
        {products.map((product, index) => (
          <div key={product.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="font-medium">{product.name}</span>
              </div>
              <div className="flex items-center gap-2 text-success text-sm font-medium">
                <TrendingUp className="w-4 h-4" />
                +{product.growth}%
              </div>
            </div>
            <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 right-0 bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(product.sales / maxSales) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span dir="ltr" style={{ fontFamily: 'Arial, sans-serif' }}>{formatNumber(product.sales)} مبيعة</span>
              <span dir="ltr" style={{ fontFamily: 'Arial, sans-serif' }}>{formatNumber(product.revenue)} ر.س</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
