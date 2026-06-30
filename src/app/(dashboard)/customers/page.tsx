"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Search, Plus, Edit2, Users, Eye } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  points: number;
  totalSpent: number;
  debt: number;
}

interface OrderHistory {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
}

const emptyCustomer = {
  name: "",
  phone: "",
  email: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<
    typeof emptyCustomer & { id?: string }
  >(emptyCustomer);
  const [isEditing, setIsEditing] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      setCustomers(data.customers || data || []);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const openAddModal = () => {
    setEditingCustomer({ ...emptyCustomer });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  const viewCustomerDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailModal(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/orders`);
      const data = await res.json();
      setOrderHistory(data.orders || data || []);
    } catch {
      setOrderHistory([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = isEditing
        ? `/api/customers/${editingCustomer.id}`
        : "/api/customers";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingCustomer),
      });
      if (res.ok) {
        setModalOpen(false);
        fetchCustomers();
      }
    } catch {
      // handle error
    }
  };

  const statusLabels: Record<string, string> = {
    completed: "Hoàn thành",
    pending: "Chờ xử lý",
    cancelled: "Đã hủy",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Khách hàng</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý thông tin khách hàng
          </p>
        </div>
        <Button onClick={openAddModal}>
          <Plus size={18} className="mr-1" />
          Thêm khách hàng
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Tìm theo tên, SĐT, email..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Khách hàng
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Số điện thoại
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Email
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Điểm
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Tổng chi tiêu
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Công nợ
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
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    <Users size={32} className="mx-auto mb-2 opacity-50" />
                    Không có khách hàng
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-600">
                            {customer.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {customer.phone}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {customer.email || "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full text-xs">
                        {customer.points}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(customer.totalSpent)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          customer.debt > 0 ? "text-red-600 font-medium" : ""
                        }
                      >
                        {formatCurrency(customer.debt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => viewCustomerDetail(customer)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg"
                        >
                          <Eye size={16} className="text-gray-500" />
                        </button>
                        <button
                          onClick={() => openEditModal(customer)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg"
                        >
                          <Edit2 size={16} className="text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? "Chỉnh sửa khách hàng" : "Thêm khách hàng mới"}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Tên khách hàng"
            value={editingCustomer.name}
            onChange={(e) =>
              setEditingCustomer((prev) => ({ ...prev, name: e.target.value }))
            }
            required
          />
          <Input
            label="Số điện thoại"
            value={editingCustomer.phone}
            onChange={(e) =>
              setEditingCustomer((prev) => ({ ...prev, phone: e.target.value }))
            }
            required
          />
          <Input
            label="Email"
            type="email"
            value={editingCustomer.email}
            onChange={(e) =>
              setEditingCustomer((prev) => ({ ...prev, email: e.target.value }))
            }
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit">
              {isEditing ? "Cập nhật" : "Thêm khách hàng"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Customer Detail Modal */}
      <Modal
        open={detailModal}
        onClose={() => setDetailModal(false)}
        title={`Khách hàng - ${selectedCustomer?.name || ""}`}
        size="lg"
      >
        {selectedCustomer && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Điểm tích lũy</p>
                <p className="text-xl font-bold text-blue-600">
                  {selectedCustomer.points}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Tổng chi tiêu</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(selectedCustomer.totalSpent)}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Công nợ</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(selectedCustomer.debt)}
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Lịch sử đơn hàng</h3>
              {orderHistory.length > 0 ? (
                <div className="space-y-2">
                  {orderHistory.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {order.orderNumber}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatCurrency(order.total)}
                        </p>
                        <span className="text-xs text-gray-500">
                          {statusLabels[order.status] || order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  Chưa có đơn hàng
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
