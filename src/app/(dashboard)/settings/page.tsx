"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Save, Check } from "lucide-react";

interface StoreSettings {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  pointsPerOrder: number;
  pointsToDiscount: number;
  discountPerPoint: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: "",
    storePhone: "",
    storeAddress: "",
    pointsPerOrder: 1,
    pointsToDiscount: 100,
    discountPerPoint: 1000,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings || data) {
          setSettings((prev) => ({ ...prev, ...(data.settings || data) }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">Đang tải...</div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cài đặt</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cấu hình thông tin cửa hàng
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Store Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings size={20} className="text-gray-400" />
            <h2 className="text-lg font-semibold">Thông tin cửa hàng</h2>
          </div>
          <div className="space-y-4">
            <Input
              label="Tên cửa hàng"
              value={settings.storeName}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, storeName: e.target.value }))
              }
              placeholder="Fashion Store"
            />
            <Input
              label="Số điện thoại"
              value={settings.storePhone}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  storePhone: e.target.value,
                }))
              }
              placeholder="0123 456 789"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Địa chỉ
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                value={settings.storeAddress}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    storeAddress: e.target.value,
                  }))
                }
                placeholder="123 Nguyễn Huệ, Quận 1, TP.HCM"
              />
            </div>
          </div>
        </div>

        {/* Points Configuration */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">Cấu hình điểm thưởng</h2>
          <div className="space-y-4">
            <Input
              label="Điểm tích lũy mỗi đơn hàng"
              type="number"
              min={0}
              value={settings.pointsPerOrder}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  pointsPerOrder: Number(e.target.value),
                }))
              }
            />
            <Input
              label="Số điểm để quy đổi"
              type="number"
              min={1}
              value={settings.pointsToDiscount}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  pointsToDiscount: Number(e.target.value),
                }))
              }
            />
            <Input
              label="Giá trị mỗi điểm (VNĐ)"
              type="number"
              min={0}
              value={settings.discountPerPoint}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  discountPerPoint: Number(e.target.value),
                }))
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? (
              "Đang lưu..."
            ) : saved ? (
              <>
                <Check size={18} className="mr-1" />
                Đã lưu
              </>
            ) : (
              <>
                <Save size={18} className="mr-1" />
                Lưu cài đặt
              </>
            )}
          </Button>
          {saved && (
            <span className="text-sm text-green-600">
              Cài đặt đã được lưu thành công!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
