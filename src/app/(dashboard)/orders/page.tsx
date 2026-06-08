"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Search, Eye, FileText } from "lucide-react";

interface OrderItem {
  id: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string | null;
  total: number;
  discount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items?: OrderItem[];
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

const paymentLabels: Record<string, string> = {
  cash: "Tiền mặt",
  transfer: "Chuyển khoản",
  card: "Thẻ",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailModal, setDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders || data || []);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, statusFilter, dateFrom, dateTo]);

  const viewOrderDetail = async (order: Order) => {
    try {
      const res = await fetch(`/api/orders/${order.id}`);
      const data = await res.json();
      setSelectedOrder(data.order || data);
    } catch {
      setSelectedOrder(order);
    }
    setDetailModal(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Đơn hàng</h1>
        <p className="text-sm text-gray-500 mt-1">
          Quản lý danh sách đơn hàng
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Tìm đơn hàng..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          options={[
            { value: "", label: "Tất cả trạng thái" },
            { value: "completed", label: "Hoàn thành" },
            { value: "pending", label: "Chờ xử lý" },
            { value: "cancelled", label: "Đã hủy" },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
        />
        <input
          type="date"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <input
          type="date"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Mã đơn
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Khách hàng
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Tổng tiền
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">
                  Thanh toán
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">
                  Trạng thái
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Ngày tạo
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    Đang tải...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-50" />
                    Không có đơn hàng
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {order.customerName || "Khách lẻ"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {paymentLabels[order.paymentMethod] || order.paymentMethod}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          statusColors[order.status] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => viewOrderDetail(order)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg"
                      >
                        <Eye size={16} className="text-gray-500" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      <Modal
        open={detailModal}
        onClose={() => setDetailModal(false)}
        title={`Chi tiết đơn hàng - ${selectedOrder?.orderNumber || ""}`}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Khách hàng</p>
                <p className="font-medium">
                  {selectedOrder.customerName || "Khách lẻ"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Ngày tạo</p>
                <p className="font-medium">
                  {formatDate(selectedOrder.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Phương thức thanh toán</p>
                <p className="font-medium">
                  {paymentLabels[selectedOrder.paymentMethod] ||
                    selectedOrder.paymentMethod}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Trạng thái</p>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    statusColors[selectedOrder.status] ||
                    "bg-gray-100 text-gray-600"
                  }`}
                >
                  {statusLabels[selectedOrder.status] || selectedOrder.status}
                </span>
              </div>
            </div>

            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Sản phẩm</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Sản phẩm</th>
                      <th className="text-center py-2">SL</th>
                      <th className="text-right py-2">Đơn giá</th>
                      <th className="text-right py-2">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item) => (
                      <tr key={item.id} className="border-b border-gray-50">
                        <td className="py-2">
                          <p className="font-medium">{item.productName}</p>
                          {item.variantLabel && (
                            <p className="text-xs text-gray-500">
                              {item.variantLabel}
                            </p>
                          )}
                        </td>
                        <td className="py-2 text-center">{item.quantity}</td>
                        <td className="py-2 text-right">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="py-2 text-right font-medium">
                          {formatCurrency(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t pt-3 space-y-1 text-sm">
              {selectedOrder.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Giảm giá</span>
                  <span>-{formatCurrency(selectedOrder.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Tổng cộng</span>
                <span className="text-blue-600">
                  {formatCurrency(selectedOrder.total)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
