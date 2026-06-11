"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  Search,
  Plus,
  Minus,
  Warehouse,
  ArrowUpDown,
  History,
} from "lucide-react";

interface StockItem {
  id: string;
  productName: string;
  variantId: string;
  size: string | null;
  color: string | null;
  sku: string;
  stock: number;
  status: string;
}

interface StockMovement {
  id: string;
  productName: string;
  variantLabel: string;
  type: string;
  quantity: number;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export default function InventoryPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [adjustModal, setAdjustModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"stock" | "history">("stock");
  const [adjustForm, setAdjustForm] = useState({
    variantId: "",
    type: "add",
    quantity: 0,
    reason: "",
  });

  const fetchStock = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/inventory?${params}`);
      const data = await res.json();
      setStockItems(data.items || data || []);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    try {
      const res = await fetch("/api/inventory/movements");
      const data = await res.json();
      setMovements(data.movements || data || []);
    } catch {
      // handle error
    }
  };

  useEffect(() => {
    fetchStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchMovements();
    }
  }, [activeTab]);

  const openAdjustModal = (item: StockItem) => {
    setAdjustForm({
      variantId: item.variantId,
      type: "add",
      quantity: 0,
      reason: "",
    });
    setAdjustModal(true);
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adjustForm),
      });
      if (res.ok) {
        setAdjustModal(false);
        fetchStock();
      }
    } catch {
      // handle error
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0)
      return { label: "Hết hàng", className: "bg-red-100 text-red-700" };
    if (stock <= 5)
      return { label: "Sắp hết", className: "bg-orange-100 text-orange-700" };
    return { label: "Còn hàng", className: "bg-green-100 text-green-700" };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kho hàng</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý tồn kho và nhập xuất
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "stock"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("stock")}
        >
          <Warehouse size={16} className="inline mr-1.5" />
          Tồn kho
        </button>
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("history")}
        >
          <History size={16} className="inline mr-1.5" />
          Lịch sử xuất nhập
        </button>
      </div>

      {activeTab === "stock" && (
        <>
          {/* Search */}
          <div className="relative max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Tìm theo tên sản phẩm, SKU..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Stock Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Sản phẩm
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Phân loại
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      SKU
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">
                      Tồn kho
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">
                      Trạng thái
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-8 text-gray-400"
                      >
                        Đang tải...
                      </td>
                    </tr>
                  ) : stockItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-8 text-gray-400"
                      >
                        Không có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    stockItems.map((item) => {
                      const status = getStockStatus(item.stock);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">
                            {item.productName}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {[item.size, item.color]
                              .filter(Boolean)
                              .join(" / ") || "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {item.sku}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {item.stock}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openAdjustModal(item)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg"
                              title="Điều chỉnh tồn kho"
                            >
                              <ArrowUpDown
                                size={16}
                                className="text-gray-500"
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "history" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Sản phẩm
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Phân loại
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">
                    Loại
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    Số lượng
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Lý do
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Người thực hiện
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Thời gian
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      Chưa có lịch sử xuất nhập kho
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {m.productName}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {m.variantLabel || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            m.type === "add" || m.type === "in"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {m.type === "add" || m.type === "in" ? (
                            <Plus size={12} className="inline mr-0.5" />
                          ) : (
                            <Minus size={12} className="inline mr-0.5" />
                          )}
                          {m.type === "add" || m.type === "in"
                            ? "Nhập"
                            : "Xuất"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {m.quantity}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{m.reason}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {m.createdBy}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(m.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      <Modal
        open={adjustModal}
        onClose={() => setAdjustModal(false)}
        title="Điều chỉnh tồn kho"
        size="sm"
      >
        <form onSubmit={handleAdjust} className="space-y-4">
          <Select
            label="Loại điều chỉnh"
            options={[
              { value: "add", label: "Nhập kho" },
              { value: "remove", label: "Xuất kho" },
            ]}
            value={adjustForm.type}
            onChange={(e) =>
              setAdjustForm((prev) => ({ ...prev, type: e.target.value }))
            }
          />
          <Input
            label="Số lượng"
            type="number"
            min={1}
            value={adjustForm.quantity || ""}
            onChange={(e) =>
              setAdjustForm((prev) => ({
                ...prev,
                quantity: Number(e.target.value),
              }))
            }
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lý do
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={adjustForm.reason}
              onChange={(e) =>
                setAdjustForm((prev) => ({ ...prev, reason: e.target.value }))
              }
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAdjustModal(false)}
            >
              Hủy
            </Button>
            <Button type="submit">Xác nhận</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
