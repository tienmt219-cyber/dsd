"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  TrendingUp,
  Package,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardData {
  stats: {
    todayRevenue: number;
    todayOrders: number;
    todayCustomers: number;
    lowStockAlerts: number;
  };
  revenueChart: { date: string; revenue: number }[];
  topProducts: { id: string; name: string; sold: number; revenue: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customer: string;
    total: number;
    status: string;
    createdAt: string;
  }[];
  lowStockItems: {
    id: string;
    product: string;
    variant: string;
    stock: number;
  }[];
}

const statusLabels: Record<string, string> = {
  completed: "Hoàn thành",
  pending: "Chờ xử lý",
  cancelled: "Đã hủy",
};

const statusColors: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Đang tải...</div>
      </div>
    );
  }

  const stats = data?.stats || {
    todayRevenue: 0,
    todayOrders: 0,
    todayCustomers: 0,
    lowStockAlerts: 0,
  };

  const statCards = [
    {
      label: "Doanh thu hôm nay",
      value: formatCurrency(stats.todayRevenue),
      icon: DollarSign,
      color: "bg-blue-50 text-blue-600",
      iconBg: "bg-blue-100",
    },
    {
      label: "Đơn hàng hôm nay",
      value: stats.todayOrders.toString(),
      icon: ShoppingCart,
      color: "bg-green-50 text-green-600",
      iconBg: "bg-green-100",
    },
    {
      label: "Khách hàng hôm nay",
      value: stats.todayCustomers.toString(),
      icon: Users,
      color: "bg-purple-50 text-purple-600",
      iconBg: "bg-purple-100",
    },
    {
      label: "Sắp hết hàng",
      value: stats.lowStockAlerts.toString(),
      icon: AlertTriangle,
      color: "bg-red-50 text-red-600",
      iconBg: "bg-red-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tổng quan hoạt động kinh doanh
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl shadow-sm p-5 border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
              </div>
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.iconBg}`}
              >
                <card.icon size={24} className={card.color.split(" ")[1]} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Doanh thu 7 ngày qua</h2>
            <p className="text-sm text-gray-500">Biểu đồ doanh thu theo ngày</p>
          </div>
          <TrendingUp size={20} className="text-blue-600" />
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.revenueChart || []}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), "Doanh thu"]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Sản phẩm bán chạy</h2>
            <Package size={20} className="text-gray-400" />
          </div>
          <div className="space-y-3">
            {(data?.topProducts || []).map((product, idx) => (
              <div
                key={product.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-gray-500">
                      Đã bán: {product.sold}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold">
                  {formatCurrency(product.revenue)}
                </span>
              </div>
            ))}
            {(!data?.topProducts || data.topProducts.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">
                Chưa có dữ liệu
              </p>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Đơn hàng gần đây</h2>
            <ShoppingCart size={20} className="text-gray-400" />
          </div>
          <div className="space-y-3">
            {(data?.recentOrders || []).map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{order.orderNumber}</p>
                  <p className="text-xs text-gray-500">
                    {order.customer || "Khách lẻ"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {formatCurrency(order.total)}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      statusColors[order.status] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {statusLabels[order.status] || order.status}
                  </span>
                </div>
              </div>
            ))}
            {(!data?.recentOrders || data.recentOrders.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">
                Chưa có đơn hàng
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Cảnh báo tồn kho thấp</h2>
          <AlertTriangle size={20} className="text-orange-500" />
        </div>
        {(data?.lowStockItems || []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-500 font-medium">
                    Sản phẩm
                  </th>
                  <th className="text-left py-2 text-gray-500 font-medium">
                    Phân loại
                  </th>
                  <th className="text-right py-2 text-gray-500 font-medium">
                    Tồn kho
                  </th>
                  <th className="text-right py-2 text-gray-500 font-medium">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody>
                {data!.lowStockItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="py-2 font-medium">{item.product}</td>
                    <td className="py-2 text-gray-500">{item.variant}</td>
                    <td className="py-2 text-right">{item.stock}</td>
                    <td className="py-2 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          item.stock === 0
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {item.stock === 0 ? "Hết hàng" : "Sắp hết"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            Không có cảnh báo tồn kho
          </p>
        )}
      </div>
    </div>
  );
}
