"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Check,
  User,
  X,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface Variant {
  id: string;
  size: string | null;
  color: string | null;
  price: number;
  stock: number;
  sku: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  sellPrice: number;
  image: string | null;
  categoryId: string;
  variants: Variant[];
}

interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  price: number;
  quantity: number;
  maxStock: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  points: number;
}

export default function POSPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [variantModal, setVariantModal] = useState<Product | null>(null);
  const [successModal, setSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || d || []))
      .catch(() => {});
    fetch("/api/products?limit=200")
      .then((r) => r.json())
      .then((d) => {
        const prods = d.products || d || [];
        setProducts(prods);
        setFilteredProducts(prods);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let result = products;
    if (selectedCategory !== "all") {
      result = result.filter((p) => p.categoryId === selectedCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }
    setFilteredProducts(result);
  }, [selectedCategory, searchQuery, products]);

  const searchCustomers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setCustomers([]);
      return;
    }
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setCustomers(data.customers || data || []);
      setShowCustomerDropdown(true);
    } catch {
      setCustomers([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchCustomers(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch, searchCustomers]);

  const handleProductClick = (product: Product) => {
    if (product.variants && product.variants.length > 1) {
      setVariantModal(product);
    } else if (product.variants && product.variants.length === 1) {
      addToCart(product, product.variants[0]);
    } else {
      addToCart(product, null);
    }
  };

  const addToCart = (product: Product, variant: Variant | null) => {
    const variantId = variant?.id || product.id;
    const variantLabel = variant
      ? [variant.size, variant.color].filter(Boolean).join(" / ") || "Mặc định"
      : "Mặc định";
    const price = variant?.price || product.sellPrice;
    const maxStock = variant?.stock ?? 999;

    setCart((prev) => {
      const existing = prev.find((item) => item.variantId === variantId);
      if (existing) {
        if (existing.quantity >= maxStock) return prev;
        return prev.map((item) =>
          item.variantId === variantId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          variantId,
          productId: product.id,
          productName: product.name,
          variantLabel,
          price,
          quantity: 1,
          maxStock,
        },
      ];
    });
    setVariantModal(null);
  };

  const updateQuantity = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.variantId === variantId
            ? {
                ...item,
                quantity: Math.min(
                  Math.max(1, item.quantity + delta),
                  item.maxStock
                ),
              }
            : item
        )
    );
  };

  const removeFromCart = (variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variantId !== variantId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = Math.round(subtotal * (discount / 100));
  const total = subtotal - discountAmount;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.id || null,
          paymentMethod,
          discount: discountAmount,
          items: cart.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
          })),
        }),
      });

      if (res.ok) {
        setSuccessModal(true);
        setCart([]);
        setDiscount(0);
        setSelectedCustomer(null);
        setCustomerSearch("");
      }
    } catch {
      // error handling
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-7rem)]">
      {/* Left: Product Grid */}
      <div className="flex-[6] flex flex-col min-w-0">
        {/* Search & Filter */}
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Tìm sản phẩm theo tên hoặc SKU..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                selectedCategory === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
              onClick={() => setSelectedCategory("all")}
            >
              Tất cả
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => handleProductClick(product)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-left hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div className="w-full aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                <ShoppingBag size={24} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium truncate">{product.name}</p>
              <p className="text-xs text-gray-400">{product.sku}</p>
              <p className="text-sm font-bold text-blue-600 mt-1">
                {formatCurrency(product.sellPrice)}
              </p>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center text-gray-400 py-12">
              Không tìm thấy sản phẩm
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="flex-[4] bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col min-w-0">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Giỏ hàng</h2>
        </div>

        {/* Customer Selector */}
        <div className="p-4 border-b">
          <div className="relative">
            <User
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{selectedCustomer.name}</p>
                  <p className="text-xs text-gray-500">
                    {selectedCustomer.phone} &middot; {selectedCustomer.points} điểm
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerSearch("");
                  }}
                  className="p-1 hover:bg-blue-100 rounded"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Tìm khách hàng (SĐT)..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onFocus={() => customerSearch.length >= 2 && setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                />
                {showCustomerDropdown && customers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onMouseDown={() => {
                          setSelectedCustomer(c);
                          setCustomerSearch("");
                          setShowCustomerDropdown(false);
                        }}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-gray-400 ml-2">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <ShoppingBag size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Giỏ hàng trống</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.variantId}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.productName}
                  </p>
                  <p className="text-xs text-gray-500">{item.variantLabel}</p>
                  <p className="text-sm font-semibold text-blue-600">
                    {formatCurrency(item.price)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQuantity(item.variantId, -1)}
                    className="w-7 h-7 rounded-md bg-white border flex items-center justify-center hover:bg-gray-50"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.variantId, 1)}
                    className="w-7 h-7 rounded-md bg-white border flex items-center justify-center hover:bg-gray-50"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="text-right min-w-[80px]">
                  <p className="text-sm font-semibold">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                </div>
                <button
                  onClick={() => removeFromCart(item.variantId)}
                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Checkout Section */}
        <div className="p-4 border-t space-y-3">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Giảm giá (%)"
              value={discount || ""}
              onChange={(e) =>
                setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))
              }
              className="flex-1"
            />
            <Select
              options={[
                { value: "cash", label: "Tiền mặt" },
                { value: "transfer", label: "Chuyển khoản" },
                { value: "card", label: "Thẻ" },
              ]}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Tạm tính</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Giảm giá ({discount}%)</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Tổng cộng</span>
              <span className="text-blue-600">{formatCurrency(total)}</span>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
          >
            {loading ? "Đang xử lý..." : "Thanh toán"}
          </Button>
        </div>
      </div>

      {/* Variant Selection Modal */}
      <Modal
        open={!!variantModal}
        onClose={() => setVariantModal(null)}
        title={`Chọn phân loại - ${variantModal?.name || ""}`}
      >
        <div className="grid grid-cols-2 gap-3">
          {variantModal?.variants.map((variant) => (
            <button
              key={variant.id}
              onClick={() => addToCart(variantModal, variant)}
              disabled={variant.stock <= 0}
              className="p-3 border rounded-lg text-left hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <p className="text-sm font-medium">
                {[variant.size, variant.color].filter(Boolean).join(" / ")}
              </p>
              <p className="text-sm font-bold text-blue-600">
                {formatCurrency(variant.price)}
              </p>
              <p className="text-xs text-gray-400">
                Kho: {variant.stock}
              </p>
            </button>
          ))}
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal
        open={successModal}
        onClose={() => setSuccessModal(false)}
        title="Thanh toán thành công"
        size="sm"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <p className="text-lg font-semibold mb-1">Đơn hàng đã được tạo!</p>
          <p className="text-sm text-gray-500 mb-4">
            Thanh toán thành công
          </p>
          <Button onClick={() => setSuccessModal(false)} className="w-full">
            Đóng
          </Button>
        </div>
      </Modal>
    </div>
  );
}
