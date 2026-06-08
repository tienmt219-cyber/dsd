export const API_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec'
export const API_PASSWORD = 'dreamteam2026'

export const STATUS = {
  CHUA_DAT: 'CHƯA ĐẶT',
  CHO_HANG: 'Chờ hàng',
  DANG_SHIP: 'Đang ship',
  VE_KHO: 'Về kho',
  DA_GUI: 'Đã gửi',
  DA_XOA: 'Đã xoá',
  LUU_TRU: 'Lưu trữ',
}

export const STATUS_FLOW = [
  STATUS.CHUA_DAT,
  STATUS.CHO_HANG,
  STATUS.DANG_SHIP,
  STATUS.VE_KHO,
  STATUS.DA_GUI,
]

export const STATUS_COLORS = {
  [STATUS.CHUA_DAT]: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  [STATUS.CHO_HANG]: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  [STATUS.DANG_SHIP]: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  [STATUS.VE_KHO]: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400', dot: 'bg-teal-500' },
  [STATUS.DA_GUI]: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  [STATUS.DA_XOA]: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  [STATUS.LUU_TRU]: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-400', dot: 'bg-gray-500' },
}

export const PRODUCT_PREFIXES = {
  AK: 'Áo khoác',
  AT: 'Áo thun',
  QJ: 'Quần jean',
  VD: 'Váy đầm',
  PK: 'Phụ kiện',
  TU: 'Túi',
}

export const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '35', '36', '37', '38', '39', '40']

export const BANK_INFO = {
  paypay: 'mam264',
  mufj: {
    branch: '454-柏支店(カシワ)',
    account: '0509306',
    name: 'グエンダンティエン',
  },
  techcombank: {
    account: '8109030991196',
    name: 'TRINH THI PHUONG',
  },
}

export const COST = {
  SHIP_GZ: 100,
  BOSS_FEE: 80,
  BOSS_MULTI: 200,
}

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/' },
  { key: 'orders', label: 'Đơn hàng', icon: 'ClipboardList', path: '/orders' },
  { key: 'add-order', label: 'Tạo đơn', icon: 'PlusCircle', path: '/add-order' },
  { key: 'ai-order', label: 'AI nhập đơn', icon: 'Bot', path: '/ai-order' },
  { key: 'ai-chat', label: 'Trợ lý AI', icon: 'MessageSquare', path: '/ai-chat' },
  { key: 'gz', label: 'Đặt GZ', icon: 'Factory', path: '/gz' },
  { key: 'ems', label: 'Kiện EMS', icon: 'Plane', path: '/ems' },
  { key: 'ship', label: 'Chờ gửi', icon: 'Truck', path: '/ship' },
  { key: 'stock', label: 'Kho', icon: 'Package', path: '/stock' },
  { key: 'products', label: 'Sản phẩm', icon: 'Tag', path: '/products' },
  { key: 'tools', label: 'Tools', icon: 'Wrench', path: '/tools' },
  { key: 'ck', label: 'CK Tracking', icon: 'CreditCard', path: '/ck' },
]
