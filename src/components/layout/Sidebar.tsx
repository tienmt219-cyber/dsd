"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FolderOpen,
  Users,
  FileText,
  UserCog,
  Warehouse,
  Settings,
  BarChart3,
  LogOut,
  Store,
} from "lucide-react";

const menuItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "Bán hàng", icon: ShoppingCart },
  { href: "/orders", label: "Đơn hàng", icon: FileText },
  { href: "/products", label: "Sản phẩm", icon: Package },
  { href: "/categories", label: "Danh mục", icon: FolderOpen },
  { href: "/inventory", label: "Kho hàng", icon: Warehouse },
  { href: "/customers", label: "Khách hàng", icon: Users },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/staff", label: "Nhân viên", icon: UserCog },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-screen fixed left-0 top-0">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Store className="text-blue-400" size={28} />
          <div>
            <h1 className="text-lg font-bold">Fashion POS</h1>
            <p className="text-xs text-gray-400">Quản lý bán hàng</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2 w-full text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <LogOut size={20} />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
