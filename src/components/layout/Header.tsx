import { Bell, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Header() {
  return (
    <header className="h-16 bg-card border-b border-border px-6 flex items-center justify-between shadow-card">
      {/* Search */}
      <div className="relative w-96">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="بحث في المتجر..."
          className="pr-10 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 left-1 w-2 h-2 bg-destructive rounded-full" />
        </Button>

        {/* User */}
        <div className="flex items-center gap-3 pr-3 border-r border-border">
          <div className="text-left">
            <p className="text-sm font-semibold">أحمد محمد</p>
            <p className="text-xs text-muted-foreground">مدير المتجر</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>
    </header>
  );
}
