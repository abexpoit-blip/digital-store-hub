// Mock data for prototype. Will be replaced by real API calls to VPS Express backend.
export const stats = {
  totalUsers: 2847,
  todayDeposit: 18450,
  todayOrders: 64,
  totalRevenue: 487320,
  pendingReplace: 7,
  lowStockItems: 3,
  activeNow: 142,
  conversionRate: 14.2,
};

export const revenueData = [
  { day: "Sat", revenue: 12400, orders: 38 },
  { day: "Sun", revenue: 15200, orders: 47 },
  { day: "Mon", revenue: 9800, orders: 31 },
  { day: "Tue", revenue: 18900, orders: 62 },
  { day: "Wed", revenue: 22100, orders: 71 },
  { day: "Thu", revenue: 17400, orders: 55 },
  { day: "Fri", revenue: 18450, orders: 64 },
];

export const productMix = [
  { name: "VPN Premium", value: 42, color: "var(--color-chart-1)" },
  { name: "FB Ad Account", value: 28, color: "var(--color-chart-2)" },
  { name: "Google Ads", value: 18, color: "var(--color-chart-3)" },
  { name: "TikTok Ads", value: 12, color: "var(--color-chart-4)" },
];

export const recentUsers = [
  { id: 1, tg_id: "847203911", username: "@rakib_bd", balance: 2450, joined: "2 hours ago", orders: 12, status: "active" },
  { id: 2, tg_id: "623094821", username: "@shahin_ad", balance: 850, joined: "5 hours ago", orders: 4, status: "active" },
  { id: 3, tg_id: "501928374", username: "@nadia_vpn", balance: 12300, joined: "1 day ago", orders: 47, status: "vip" },
  { id: 4, tg_id: "918273645", username: "@hasib_pro", balance: 0, joined: "1 day ago", orders: 1, status: "active" },
  { id: 5, tg_id: "374829103", username: "@spam_user99", balance: 50, joined: "2 days ago", orders: 0, status: "banned" },
  { id: 6, tg_id: "284756103", username: "@arif_buy", balance: 4200, joined: "3 days ago", orders: 23, status: "active" },
];

export const recentDeposits = [
  { id: 1001, user: "@rakib_bd", amount: 1500, method: "Bkash", txn: "8B47FX2K", time: "12 min ago", status: "approved" },
  { id: 1002, user: "@nadia_vpn", amount: 5000, method: "Binance", txn: "USDT-TRC20", time: "34 min ago", status: "approved" },
  { id: 1003, user: "@arif_buy", amount: 800, method: "Nagad", txn: "9X23K1L4", time: "1 hour ago", status: "pending" },
  { id: 1004, user: "@shahin_ad", amount: 2200, method: "Bkash", txn: "7Y82MQ3", time: "2 hours ago", status: "approved" },
  { id: 1005, user: "@hasib_pro", amount: 500, method: "Nagad", txn: "5K91PL2", time: "3 hours ago", status: "rejected" },
];

// Real categories from store.py / store.db (bot stock table: id, category, data)
export type StockCategory = {
  key: string;          // DB category value
  product: string;      // Display name
  icon: string;         // Emoji used in bot
  available: number;    // COUNT(*) FROM stock WHERE category=?
  sold: number;         // SUM(qty) FROM sales WHERE category=?
  price: number;        // config.price_<key>
};

export const stockItems: StockCategory[] = [
  { key: "fb61",   product: "FB 61xx ID",     icon: "📘", available: 84, sold: 1820, price: 10 },
  { key: "fb1000", product: "FB 1000xx ID",   icon: "📕", available: 31, sold: 412,  price: 7  },
  { key: "bmfb",   product: "Facebook BM",    icon: "💼", available: 6,  sold: 118,  price: 7  },
  { key: "bmig",   product: "Instagram BM",   icon: "📸", available: 4,  sold: 64,   price: 7  },
  { key: "tempid", product: "Temp ID",        icon: "⏱️", available: 2,  sold: 12,   price: 7  },
];

export const replaceRequests = [
  { id: 1, user: "@rakib_bd", tg_id: "847203911", order_id: "#ORD-2847", product: "FB Ad Account $50", reason: "Account suspended within 24h", time: "23 min ago" },
  { id: 2, user: "@arif_buy", tg_id: "284756103", order_id: "#ORD-2841", product: "VPN Premium 1 Month", reason: "Login not working", time: "1 hour ago" },
  { id: 3, user: "@nadia_vpn", tg_id: "501928374", order_id: "#ORD-2839", product: "Google Ads Threshold", reason: "Wrong credentials provided", time: "3 hours ago" },
];
