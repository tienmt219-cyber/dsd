"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Package,
  X,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface Variant {
  id?: string;
  size: string;
  color: string;
  price: number;
  costPrice: number;
  stock: number;
  sku: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  categoryName?: string;
  costPrice: number;
  sellPrice: number;
  description: string;
  status: string;
  totalStock: number;
  variants: Variant[];
}

const emptyProduct = {
  name: "",
  sku: "",
  categoryId: "",
  costPrice: 0,
  sellPrice: 0,
  description: "",
  variants: [] as Variant[],
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<typeof emptyProduct & { id?: string }>(emptyProduct);
  const [isEditing, setIsEditing] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts(data.products || data || []);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setCategories(data.categories || data || []);
    } catch {
      // handle error
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, categoryFilter]);

  const openAddModal = () => {
    setEditingProduct({ ...emptyProduct });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct({
      id: product.id,
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId,
      costPrice: product.costPrice,
      sellPrice: product.sellPrice,
      description: product.description || "",
      variants: product.variants || [],
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  const addVariant = () => {
    setEditingProduct((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          size: "",
          color: "",
          price: prev.sellPrice,
          costPrice: prev.costPrice,
          stock: 0,
          sku: "",
        },
      ],
    }));
  };

  const updateVariant = (index: number, field: string, value: string | number) => {
    setEditingProduct((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      ),
    }));
  };

  const removeVariant = (index: number) => {
    setEditingProduct((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = isEditing
        ? `/api/products/${editingProduct.id}`
        : "/api/products";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProduct),
      });
      if (res.ok) {
        setModalOpen(false);
        fetchProducts();
      }
    } catch {
      // handle error
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa sản phẩm này?")) return;
    try {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
      fetchProducts();
    } catch {
      // handle error
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sản phẩm</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý danh sách sản phẩm
          </p>
        </div>
        <Button onClick={openAddModal}>
          <Plus size={18} className="mr-1" />
          Thêm sản phẩm
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Tìm sản phẩm..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select
          options={[
            { value: "", label: "Tất cả danh mục" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-48"
        />
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Sản phẩm
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  SKU
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Danh mục
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Giá bán
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
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    Đang tải...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    Không có sản phẩm nào
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package size={16} className="text-gray-300" />
                        </div>
                        <span className="font-medium">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{product.sku}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {product.categoryName || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(product.sellPrice)}
                    </td>
                    <td className="px-4 py-3 text-right">{product.totalStock}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          product.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {product.status === "active" ? "Đang bán" : "Ngừng bán"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg"
                        >
                          <Edit2 size={16} className="text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={16} className="text-red-400" />
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
        title={isEditing ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tên sản phẩm"
              value={editingProduct.name}
              onChange={(e) =>
                setEditingProduct((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
            <Input
              label="SKU"
              value={editingProduct.sku}
              onChange={(e) =>
                setEditingProduct((prev) => ({ ...prev, sku: e.target.value }))
              }
              required
            />
          </div>
          <Select
            label="Danh mục"
            options={[
              { value: "", label: "Chọn danh mục" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={editingProduct.categoryId}
            onChange={(e) =>
              setEditingProduct((prev) => ({
                ...prev,
                categoryId: e.target.value,
              }))
            }
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Giá nhập"
              type="number"
              value={editingProduct.costPrice || ""}
              onChange={(e) =>
                setEditingProduct((prev) => ({
                  ...prev,
                  costPrice: Number(e.target.value),
                }))
              }
              required
            />
            <Input
              label="Giá bán"
              type="number"
              value={editingProduct.sellPrice || ""}
              onChange={(e) =>
                setEditingProduct((prev) => ({
                  ...prev,
                  sellPrice: Number(e.target.value),
                }))
              }
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mô tả
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={editingProduct.description}
              onChange={(e) =>
                setEditingProduct((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Phân loại sản phẩm
              </label>
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <Plus size={14} className="mr-1" />
                Thêm phân loại
              </Button>
            </div>
            {editingProduct.variants.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-1">
                  <span className="col-span-2">Size</span>
                  <span className="col-span-2">Màu</span>
                  <span className="col-span-2">Giá bán</span>
                  <span className="col-span-2">Giá nhập</span>
                  <span className="col-span-2">Tồn kho</span>
                  <span className="col-span-1">SKU</span>
                  <span className="col-span-1"></span>
                </div>
                {editingProduct.variants.map((variant, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder="S, M, L..."
                      value={variant.size}
                      onChange={(e) =>
                        updateVariant(idx, "size", e.target.value)
                      }
                    />
                    <input
                      className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder="Đen, Trắng..."
                      value={variant.color}
                      onChange={(e) =>
                        updateVariant(idx, "color", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      value={variant.price || ""}
                      onChange={(e) =>
                        updateVariant(idx, "price", Number(e.target.value))
                      }
                    />
                    <input
                      type="number"
                      className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      value={variant.costPrice || ""}
                      onChange={(e) =>
                        updateVariant(idx, "costPrice", Number(e.target.value))
                      }
                    />
                    <input
                      type="number"
                      className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      value={variant.stock || ""}
                      onChange={(e) =>
                        updateVariant(idx, "stock", Number(e.target.value))
                      }
                    />
                    <input
                      className="col-span-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder="SKU"
                      value={variant.sku}
                      onChange={(e) =>
                        updateVariant(idx, "sku", e.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeVariant(idx)}
                      className="col-span-1 p-1 text-red-400 hover:text-red-600 justify-self-center"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit">
              {isEditing ? "Cập nhật" : "Thêm sản phẩm"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
