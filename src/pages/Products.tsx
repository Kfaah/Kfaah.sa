import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: "active" | "inactive" | "low_stock";
  image: string;
}

const products: Product[] = [
  { id: "1", name: "آيفون 15 برو ماكس", category: "هواتف", price: 4500, stock: 45, status: "active", image: "📱" },
  { id: "2", name: "ماك بوك برو M3", category: "لابتوب", price: 8200, stock: 12, status: "active", image: "💻" },
  { id: "3", name: "آيباد برو 12.9", category: "أجهزة لوحية", price: 3200, stock: 5, status: "low_stock", image: "📱" },
  { id: "4", name: "سماعات AirPods Pro", category: "إكسسوارات", price: 950, stock: 0, status: "inactive", image: "🎧" },
  { id: "5", name: "ساعة آبل Ultra 2", category: "ساعات", price: 1800, stock: 28, status: "active", image: "⌚" },
  { id: "6", name: "ماجيك كيبورد", category: "إكسسوارات", price: 450, stock: 67, status: "active", image: "⌨️" },
];

const statusConfig = {
  active: { label: "نشط", className: "bg-success/10 text-success" },
  inactive: { label: "غير متوفر", className: "bg-destructive/10 text-destructive" },
  low_stock: { label: "مخزون منخفض", className: "bg-warning/10 text-warning" },
};

const Products = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = products.filter((product) =>
    product.name.includes(searchQuery) || product.category.includes(searchQuery)
  );

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">المنتجات</h1>
          <p className="text-muted-foreground mt-1">إدارة منتجات متجرك</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          إضافة منتج
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 animate-slide-up">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن منتج..."
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

      {/* Products Table */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden animate-slide-up" style={{ animationDelay: "100ms" }}>
        <table className="w-full">
          <thead className="bg-secondary/50 border-b border-border">
            <tr>
              <th className="text-right p-4 font-semibold text-sm">المنتج</th>
              <th className="text-right p-4 font-semibold text-sm">الفئة</th>
              <th className="text-right p-4 font-semibold text-sm">السعر</th>
              <th className="text-right p-4 font-semibold text-sm">المخزون</th>
              <th className="text-right p-4 font-semibold text-sm">الحالة</th>
              <th className="text-center p-4 font-semibold text-sm">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredProducts.map((product, index) => (
              <tr
                key={product.id}
                className="hover:bg-secondary/30 transition-colors animate-fade-in"
                style={{ animationDelay: `${150 + index * 50}ms` }}
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-2xl">
                      {product.image}
                    </div>
                    <span className="font-semibold">{product.name}</span>
                  </div>
                </td>
                <td className="p-4 text-muted-foreground">{product.category}</td>
                <td className="p-4 font-semibold">{product.price.toLocaleString()} ر.س</td>
                <td className="p-4">
                  <span className={cn(product.stock === 0 && "text-destructive", product.stock <= 10 && "text-warning")}>
                    {product.stock}
                  </span>
                </td>
                <td className="p-4">
                  <Badge className={cn("font-medium", statusConfig[product.status].className)}>
                    {statusConfig[product.status].label}
                  </Badge>
                </td>
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
                          عرض
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2">
                          <Edit className="w-4 h-4" />
                          تعديل
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-destructive">
                          <Trash2 className="w-4 h-4" />
                          حذف
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

export default Products;
