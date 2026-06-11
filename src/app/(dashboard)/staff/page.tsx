"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Search, Plus, Edit2, UserX, UserCheck, UserCog } from "lucide-react";

interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  active: boolean;
}

const roleLabels: Record<string, string> = {
  admin: "Quản trị viên",
  manager: "Quản lý",
  staff: "Nhân viên",
};

const emptyStaff = {
  name: "",
  email: "",
  phone: "",
  role: "staff",
  password: "",
};

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<
    typeof emptyStaff & { id?: string }
  >(emptyStaff);
  const [isEditing, setIsEditing] = useState(false);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/staff?${params}`);
      const data = await res.json();
      setStaffList(data.staff || data || []);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const openAddModal = () => {
    setEditingStaff({ ...emptyStaff });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEditModal = (staff: Staff) => {
    setEditingStaff({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      phone: staff.phone || "",
      role: staff.role,
      password: "",
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = isEditing
        ? `/api/staff/${editingStaff.id}`
        : "/api/staff";
      const method = isEditing ? "PUT" : "POST";
      const body = { ...editingStaff };
      if (isEditing && !body.password) {
        const { password: _, ...rest } = body;
        Object.assign(body, rest);
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setModalOpen(false);
        fetchStaff();
      }
    } catch {
      // handle error
    }
  };

  const toggleActive = async (staff: Staff) => {
    try {
      await fetch(`/api/staff/${staff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !staff.active }),
      });
      fetchStaff();
    } catch {
      // handle error
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nhân viên</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý nhân viên cửa hàng
          </p>
        </div>
        <Button onClick={openAddModal}>
          <Plus size={18} className="mr-1" />
          Thêm nhân viên
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
          placeholder="Tìm nhân viên..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Nhân viên
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Số điện thoại
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">
                  Vai trò
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
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    Đang tải...
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    <UserCog size={32} className="mx-auto mb-2 opacity-50" />
                    Không có nhân viên
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            staff.active
                              ? "bg-blue-100 text-blue-600"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          <span className="text-xs font-bold">
                            {staff.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium">{staff.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{staff.email}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {staff.phone || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          staff.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : staff.role === "manager"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {roleLabels[staff.role] || staff.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          staff.active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {staff.active ? "Hoạt động" : "Ngừng hoạt động"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(staff)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg"
                        >
                          <Edit2 size={16} className="text-gray-500" />
                        </button>
                        <button
                          onClick={() => toggleActive(staff)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg"
                          title={
                            staff.active ? "Vô hiệu hóa" : "Kích hoạt"
                          }
                        >
                          {staff.active ? (
                            <UserX size={16} className="text-red-400" />
                          ) : (
                            <UserCheck size={16} className="text-green-500" />
                          )}
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
        title={isEditing ? "Chỉnh sửa nhân viên" : "Thêm nhân viên mới"}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Tên nhân viên"
            value={editingStaff.name}
            onChange={(e) =>
              setEditingStaff((prev) => ({ ...prev, name: e.target.value }))
            }
            required
          />
          <Input
            label="Email"
            type="email"
            value={editingStaff.email}
            onChange={(e) =>
              setEditingStaff((prev) => ({ ...prev, email: e.target.value }))
            }
            required
          />
          <Input
            label="Số điện thoại"
            value={editingStaff.phone}
            onChange={(e) =>
              setEditingStaff((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
          <Select
            label="Vai trò"
            options={[
              { value: "staff", label: "Nhân viên" },
              { value: "manager", label: "Quản lý" },
              { value: "admin", label: "Quản trị viên" },
            ]}
            value={editingStaff.role}
            onChange={(e) =>
              setEditingStaff((prev) => ({ ...prev, role: e.target.value }))
            }
          />
          <Input
            label={isEditing ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu"}
            type="password"
            value={editingStaff.password}
            onChange={(e) =>
              setEditingStaff((prev) => ({
                ...prev,
                password: e.target.value,
              }))
            }
            required={!isEditing}
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
              {isEditing ? "Cập nhật" : "Thêm nhân viên"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
