"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Calendar,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ReportData {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    totalProfit: number;
  };
  revenueChart: { date: string; revenue: number }[];
  profitChart: { date: string; profit: number }[];
  topProducts: {
    id: string;
    name: string;
    sold: number;
    revenue: number;
  }[];
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/reports?${params}`);
      const d = await res.json();
      setData(d);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const summary = data?.summary || {
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    totalProfit: 0,
  };

  const statCards = [
    {
      label: "Tổng doanh thu",
      value: formatCurrency(summary.totalRevenue),
      icon: DollarSign,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      label: "Tổng đơn hàng",
      value: summary.totalOrders.toString(),
      icon: ShoppingCart,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      label: "Giá trị TB/đơn",
      value: formatCurrency(summary.avgOrderValue),
      icon: TrendingUp,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      label: "Lợi nhuận",
      value: formatCurrency(summary.totalProfit),
      icon: DollarSign,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo</h1>
          <p className="text-sm text-gray-500 mt-1">
            Phân tích doanh thu và lợi nhuận
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-400" />
          <input
            type="date"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải...</div>
      ) : (
        <>
          {/* Summary Stats */}
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
                    <card.icon size={24} className={card.iconColor} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">Doanh thu theo ngày</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.revenueChart || []}>
                  <defs>
                    <linearGradient
                      id="colorRev"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#2563eb"
                        stopOpacity={0.1}
                      />
                      <stop
                        offset="95%"
                        stopColor="#2563eb"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatCurrency(Number(value)),
                      "Doanh thu",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#colorRev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Profit Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">
              Lợi nhuận theo ngày
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.profitChart || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatCurrency(Number(value)),
                      "Lợi nhuận",
                    ]}
                  />
                  <Bar
                    dataKey="profit"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">
              Sản phẩm bán chạy nhất
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-medium text-gray-500">
                      #
                    </th>
                    <th className="text-left py-2 font-medium text-gray-500">
                      Sản phẩm
                    </th>
                    <th className="text-right py-2 font-medium text-gray-500">
                      Đã bán
                    </th>
                    <th className="text-right py-2 font-medium text-gray-500">
                      Doanh thu
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topProducts || []).map((product, idx) => (
                    <tr
                      key={product.id}
                      className="border-b border-gray-50"
                    >
                      <td className="py-2">
                        <span className="w-6 h-6 bg-blue-50 text-blue-600 rounded-full inline-flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-2 font-medium">{product.name}</td>
                      <td className="py-2 text-right">{product.sold}</td>
                      <td className="py-2 text-right font-medium">
                        {formatCurrency(product.revenue)}
                      </td>
                    </tr>
                  ))}
                  {(!data?.topProducts || data.topProducts.length === 0) && (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center py-4 text-gray-400"
                      >
                        Chưa có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
