"use client";

import { Bell, Search, User } from "lucide-react";
import { useEffect, useState } from "react";

export function Header() {
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      });
  }, []);

  const roleLabel: Record<string, string> = {
    admin: "Quản trị viên",
    manager: "Quản lý",
    staff: "Nhân viên",
  };

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <Search size={20} className="text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm..."
          className="w-full text-sm border-none focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 hover:bg-gray-100 rounded-lg">
          <Bell size={20} className="text-gray-600" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
          {user && (
            <div className="text-sm">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-gray-500">{roleLabel[user.role] || user.role}</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
