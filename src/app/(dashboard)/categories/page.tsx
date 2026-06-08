"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Plus, Edit2, Trash2, FolderOpen } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string | null;
  _count?: { products: number };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{
    id?: string;
    name: string;
    description: string;
  }>({ name: "", description: "" });
  const [isEditing, setIsEditing] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setCategories(data.categories || data || []);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openAddModal = () => {
    setEditingCategory({ name: "", description: "" });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory({
      id: category.id,
      name: category.name,
      description: category.description || "",
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = isEditing
        ? `/api/categories/${editingCategory.id}`
        : "/api/categories";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingCategory),
      });
      if (res.ok) {
        setModalOpen(false);
        fetchCategories();
      }
    } catch {
      // handle error
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa danh mục này?")) return;
    try {
      await fetch(`/api/categories/${id}`, { method: "DELETE" });
      fetchCategories();
    } catch {
      // handle error
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Danh mục</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý danh mục sản phẩm
          </p>
        </div>
        <Button onClick={openAddModal}>
          <Plus size={18} className="mr-1" />
          Thêm danh mục
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Đang tải...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FolderOpen size={20} className="text-blue-600" />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditModal(category)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit2 size={14} className="text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900">{category.name}</h3>
              {category.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {category.description}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {category._count?.products ?? 0} sản phẩm
              </p>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              Chưa có danh mục nào
            </div>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? "Chỉnh sửa danh mục" : "Thêm danh mục mới"}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Tên danh mục"
            value={editingCategory.name}
            onChange={(e) =>
              setEditingCategory((prev) => ({ ...prev, name: e.target.value }))
            }
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mô tả
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={editingCategory.description}
              onChange={(e) =>
                setEditingCategory((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit">
              {isEditing ? "Cập nhật" : "Thêm danh mục"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
