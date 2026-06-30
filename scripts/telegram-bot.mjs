#!/usr/bin/env node
/**
 * Telegram Bot for Dream Team Order Management
 * Run: pm2 start scripts/telegram-bot.mjs --name tg-bot
 */

import TelegramBot from "node-telegram-bot-api";

// ── Config ──────────────────────────────────────────────────
const BOT_TOKEN = process.env.TG_BOT_TOKEN;
const ALLOWED_USERS = (process.env.TG_ALLOWED_USERS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const API_URL = process.env.DT_API_URL || "http://localhost:3000/api/dreamteam";
const API_KEY = process.env.DT_API_SECRET || "mam2026secret";

const SHIP_GZ = 100;
const BOSS_PER_ITEM = 80;

if (!BOT_TOKEN) {
  console.error("TG_BOT_TOKEN is required");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("🤖 Telegram bot started");

// ── Auth middleware ──────────────────────────────────────────
function isAuthorized(msg) {
  if (ALLOWED_USERS.length === 0) return true;
  return ALLOWED_USERS.includes(String(msg.from.id));
}

function unauthorized(chatId) {
  bot.sendMessage(chatId, "⛔ Bạn không có quyền sử dụng bot này.");
}

// ── API helpers ─────────────────────────────────────────────
async function apiGet() {
  const res = await fetch(API_URL, {
    headers: { "x-api-key": API_KEY },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Formatting helpers ──────────────────────────────────────
function fmtNum(n) {
  return Number(n).toLocaleString("ja-JP");
}

function fmtMoney(n) {
  return "¥" + fmtNum(n);
}

function todayStr() {
  const now = new Date();
  const offset = 9 * 60;
  const jst = new Date(now.getTime() + (offset + now.getTimezoneOffset()) * 60000);
  return `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, "0")}-${String(jst.getDate()).padStart(2, "0")}`;
}

function thisWeekStart() {
  const now = new Date();
  const offset = 9 * 60;
  const jst = new Date(now.getTime() + (offset + now.getTimezoneOffset()) * 60000);
  const day = jst.getDay();
  const diff = day === 0 ? 6 : day - 1;
  jst.setDate(jst.getDate() - diff);
  return `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, "0")}-${String(jst.getDate()).padStart(2, "0")}`;
}

function thisMonthStart() {
  const now = new Date();
  const offset = 9 * 60;
  const jst = new Date(now.getTime() + (offset + now.getTimezoneOffset()) * 60000);
  return `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, "0")}-01`;
}

function getOrderDate(o) {
  const d = o["NGÀY OD"] || "";
  return typeof d === "string" ? d.slice(0, 10) : "";
}

function hasCK(o) {
  return (o._note || "").includes("💰CK");
}

function calcProfit(order, catalogMap) {
  const maSP = (order["Mã SP"] || "").trim().toUpperCase();
  const cat = catalogMap[maSP];
  if (!cat) return 0;
  const sellPrice = Number(order["Giá sp"]) || 0;
  const buyPrice = Number(cat["Giá nhập"]) || 0;
  const qty = Number(order["Số lượng"]) || 1;
  return (sellPrice - buyPrice - SHIP_GZ - BOSS_PER_ITEM) * qty;
}

// ── /start ──────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  if (!isAuthorized(msg)) return unauthorized(msg.chat.id);
  const text = `🏪 *Dream Team Bot*

📋 *Lệnh có sẵn:*
/bc - Báo cáo tổng quan
/today - Đơn hôm nay
/timkhach \\[tên\\] - Tìm khách
/timdon \\[mã SP\\] - Tìm đơn theo SP
/ck \\[tên khách\\] - Đánh dấu CK
/no - Danh sách nợ
/chogui - Đơn chờ gửi
/thongke - Thống kê

💬 Hoặc nhắn tin tự do để hỏi!`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: "MarkdownV2" });
});

// ── /baocao or /bc ──────────────────────────────────────────
bot.onText(/\/(baocao|bc)$/, async (msg) => {
  if (!isAuthorized(msg)) return unauthorized(msg.chat.id);
  const chatId = msg.chat.id;
  try {
    bot.sendChatAction(chatId, "typing");
    const data = await apiGet();
    const orders = data.orders || [];
    const catalog = data.catalog || [];
    const catalogMap = {};
    for (const c of catalog) {
      catalogMap[(c["Mã SP"] || "").trim().toUpperCase()] = c;
    }

    const today = todayStr();
    let totalOrders = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let todayOrders = 0;
    let todayRevenue = 0;
    let ckCount = 0;
    let ckAmount = 0;
    let noCKCount = 0;
    let noCKAmount = 0;
    const byStatus = {};

    for (const o of orders) {
      totalOrders++;
      const amount = (Number(o["Giá sp"]) || 0) * (Number(o["Số lượng"]) || 1);
      totalRevenue += amount;
      totalProfit += calcProfit(o, catalogMap);

      const status = o["TRẠNG THÁI"] || "?";
      byStatus[status] = (byStatus[status] || 0) + 1;

      if (getOrderDate(o) === today) {
        todayOrders++;
        todayRevenue += amount;
      }

      if (hasCK(o)) {
        ckCount++;
        ckAmount += amount;
      } else if (status === "Đã gửi") {
        noCKCount++;
        noCKAmount += amount;
      }
    }

    const statusLines = Object.entries(byStatus)
      .sort((a, b) => b[1] - a[1])
      .map(([s, c]) => `  ${statusEmoji(s)} ${s}: ${c}`)
      .join("\n");

    const text = `📊 BÁO CÁO TỔNG QUAN

📦 Tổng đơn: ${fmtNum(totalOrders)}
💰 Doanh thu: ${fmtMoney(totalRevenue)}
📈 Lợi nhuận: ${fmtMoney(Math.round(totalProfit))}

📅 Hôm nay (${today}):
  🆕 ${todayOrders} đơn mới
  💰 DT: ${fmtMoney(todayRevenue)}

📋 Theo trạng thái:
${statusLines}

💳 Chuyển khoản:
  ✅ Đã CK: ${ckCount} đơn (${fmtMoney(ckAmount)})
  ⏳ Chưa CK: ${noCKCount} đơn (${fmtMoney(noCKAmount)})`;

    bot.sendMessage(chatId, text);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Lỗi: ${err.message}`);
  }
});

// ── /today ──────────────────────────────────────────────────
bot.onText(/\/today/, async (msg) => {
  if (!isAuthorized(msg)) return unauthorized(msg.chat.id);
  const chatId = msg.chat.id;
  try {
    bot.sendChatAction(chatId, "typing");
    const data = await apiGet();
    const orders = data.orders || [];
    const today = todayStr();

    const todayOrders = orders.filter((o) => getOrderDate(o) === today);

    if (todayOrders.length === 0) {
      return bot.sendMessage(chatId, `📅 Hôm nay (${today}) chưa có đơn nào.`);
    }

    let totalAmount = 0;
    const lines = [];
    for (const o of todayOrders) {
      const amount = (Number(o["Giá sp"]) || 0) * (Number(o["Số lượng"]) || 1);
      totalAmount += amount;
      lines.push(
        `  👤 ${o["Tên khách"]} | ${o["Mã SP"]} ${o["SIZE"]} ${o["COLOR"]} x${o["Số lượng"]} | ${fmtMoney(amount)} | ${statusEmoji(o["TRẠNG THÁI"])} ${o["TRẠNG THÁI"]}`
      );
    }

    const text = `📅 ĐƠN HÔM NAY (${today})

🆕 ${todayOrders.length} đơn | 💰 ${fmtMoney(totalAmount)}

${lines.join("\n")}`;

    bot.sendMessage(chatId, text);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Lỗi: ${err.message}`);
  }
});

// ── /timkhach [name] ────────────────────────────────────────
bot.onText(/\/timkhach\s+(.+)/, async (msg, match) => {
  if (!isAuthorized(msg)) return unauthorized(msg.chat.id);
  const chatId = msg.chat.id;
  const search = match[1].trim().toLowerCase();
  try {
    bot.sendChatAction(chatId, "typing");
    const data = await apiGet();
    const orders = data.orders || [];

    const found = orders.filter((o) =>
      (o["Tên khách"] || "").toLowerCase().includes(search)
    );

    if (found.length === 0) {
      return bot.sendMessage(chatId, `🔍 Không tìm thấy khách "${match[1].trim()}".`);
    }

    let totalAmount = 0;
    const lines = [];
    for (const o of found.slice(0, 30)) {
      const amount = (Number(o["Giá sp"]) || 0) * (Number(o["Số lượng"]) || 1);
      totalAmount += amount;
      const ck = hasCK(o) ? " ✅CK" : "";
      lines.push(
        `  ${statusEmoji(o["TRẠNG THÁI"])} ${o["Mã SP"]} ${o["SIZE"]} ${o["COLOR"]} x${o["Số lượng"]} | ${fmtMoney(amount)} | ${o["TRẠNG THÁI"]}${ck}`
      );
    }

    const customerName = found[0]["Tên khách"];
    const extra = found.length > 30 ? `\n  ...và ${found.length - 30} đơn nữa` : "";
    const text = `👤 ${customerName} — ${found.length} đơn | 💰 ${fmtMoney(totalAmount)}

${lines.join("\n")}${extra}`;

    bot.sendMessage(chatId, text);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Lỗi: ${err.message}`);
  }
});

// ── /timdon [maSP] ──────────────────────────────────────────
bot.onText(/\/timdon\s+(.+)/, async (msg, match) => {
  if (!isAuthorized(msg)) return unauthorized(msg.chat.id);
  const chatId = msg.chat.id;
  const search = match[1].trim().toUpperCase();
  try {
    bot.sendChatAction(chatId, "typing");
    const data = await apiGet();
    const orders = data.orders || [];

    const found = orders.filter((o) =>
      (o["Mã SP"] || "").toUpperCase().includes(search)
    );

    if (found.length === 0) {
      return bot.sendMessage(chatId, `🔍 Không tìm thấy đơn nào cho mã "${search}".`);
    }

    const byStatus = {};
    let totalQty = 0;
    let totalAmount = 0;

    for (const o of found) {
      const s = o["TRẠNG THÁI"] || "?";
      byStatus[s] = (byStatus[s] || 0) + 1;
      totalQty += Number(o["Số lượng"]) || 1;
      totalAmount += (Number(o["Giá sp"]) || 0) * (Number(o["Số lượng"]) || 1);
    }

    const statusSummary = Object.entries(byStatus)
      .map(([s, c]) => `${statusEmoji(s)} ${s}: ${c}`)
      .join(" | ");

    const lines = [];
    for (const o of found.slice(0, 20)) {
      const ck = hasCK(o) ? " ✅" : "";
      lines.push(
        `  👤 ${o["Tên khách"]} | ${o["SIZE"]} ${o["COLOR"]} x${o["Số lượng"]} | ${o["TRẠNG THÁI"]}${ck}`
      );
    }
    const extra = found.length > 20 ? `\n  ...và ${found.length - 20} đơn nữa` : "";

    const text = `🔍 Mã SP: ${search}

📦 ${found.length} đơn | SL: ${totalQty} | 💰 ${fmtMoney(totalAmount)}
${statusSummary}

${lines.join("\n")}${extra}`;

    bot.sendMessage(chatId, text);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Lỗi: ${err.message}`);
  }
});

// ── /ck [customer name] ─────────────────────────────────────
bot.onText(/\/ck\s+(.+)/, async (msg, match) => {
  if (!isAuthorized(msg)) return unauthorized(msg.chat.id);
  const chatId = msg.chat.id;
  const search = match[1].trim().toLowerCase();
  try {
    bot.sendChatAction(chatId, "typing");
    const data = await apiGet();
    const orders = data.orders || [];

    // Find shipped orders without CK for this customer
    const toMark = orders.filter(
      (o) =>
        (o["Tên khách"] || "").toLowerCase().includes(search) &&
        o["TRẠNG THÁI"] === "Đã gửi" &&
        !hasCK(o)
    );

    if (toMark.length === 0) {
      return bot.sendMessage(
        chatId,
        `ℹ️ Không tìm thấy đơn "Đã gửi" chưa CK nào cho "${match[1].trim()}".`
      );
    }

    const items = toMark.map((o) => ({
      rowIndex: o._rowIndex,
      tenKhach: o["Tên khách"],
      maSP: o["Mã SP"],
    }));

    const result = await apiPost({ action: "batchMarkCK", items });

    let totalAmount = 0;
    for (const o of toMark) {
      totalAmount += (Number(o["Giá sp"]) || 0) * (Number(o["Số lượng"]) || 1);
    }

    const text = `✅ Đã đánh dấu CK cho ${result.marked || toMark.length} đơn

👤 Khách: ${toMark[0]["Tên khách"]}
💰 Tổng: ${fmtMoney(totalAmount)}`;

    bot.sendMessage(chatId, text);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Lỗi: ${err.message}`);
  }
});

// ── /no ─────────────────────────────────────────────────────
bot.onText(/\/no$/, async (msg) => {
  if (!isAuthorized(msg)) return unauthorized(msg.chat.id);
  const chatId = msg.chat.id;
  try {
    bot.sendChatAction(chatId, "typing");
    const data = await apiGet();
    const orders = data.orders || [];

    // Shipped but no CK
    const owing = orders.filter(
      (o) => o["TRẠNG THÁI"] === "Đã gửi" && !hasCK(o)
    );

    if (owing.length === 0) {
      return bot.sendMessage(chatId, "🎉 Không có khách nào còn nợ!");
    }

    // Group by customer
    const byCustomer = {};
    for (const o of owing) {
      const name = o["Tên khách"] || "?";
      if (!byCustomer[name]) byCustomer[name] = { count: 0, amount: 0 };
      byCustomer[name].count++;
      byCustomer[name].amount +=
        (Number(o["Giá sp"]) || 0) * (Number(o["Số lượng"]) || 1);
    }

    const sorted = Object.entries(byCustomer).sort(
      (a, b) => b[1].amount - a[1].amount
    );

    let totalAmount = 0;
    const lines = sorted.map(([name, info]) => {
      totalAmount += info.amount;
      return `  👤 ${name}: ${info.count} đơn | ${fmtMoney(info.amount)}`;
    });

    const text = `💸 DANH SÁCH NỢ (Đã gửi, chưa CK)

📦 ${owing.length} đơn | 👥 ${sorted.length} khách | 💰 ${fmtMoney(totalAmount)}

${lines.join("\n")}`;

    bot.sendMessage(chatId, text);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Lỗi: ${err.message}`);
  }
});

// ── /chogui ─────────────────────────────────────────────────
bot.onText(/\/chogui/, async (msg) => {
  if (!isAuthorized(msg)) return unauthorized(msg.chat.id);
  const chatId = msg.chat.id;
  try {
    bot.sendChatAction(chatId, "typing");
    const data = await apiGet();
    const orders = data.orders || [];

    const waiting = orders.filter((o) => o["TRẠNG THÁI"] === "Về kho");

    if (waiting.length === 0) {
      return bot.sendMessage(chatId, "📭 Không có đơn nào chờ gửi.");
    }

    // Group by customer
    const byCustomer = {};
    for (const o of waiting) {
      const name = o["Tên khách"] || "?";
      if (!byCustomer[name]) byCustomer[name] = [];
      byCustomer[name].push(o);
    }

    const lines = [];
    for (const [name, customerOrders] of Object.entries(byCustomer)) {
      const items = customerOrders
        .map((o) => `${o["Mã SP"]} ${o["SIZE"]} ${o["COLOR"]} x${o["Số lượng"]}`)
        .join(", ");
      lines.push(`  👤 ${name} (${customerOrders.length}): ${items}`);
    }

    const text = `📦 CHỜ GỬI (Về kho)

📦 ${waiting.length} đơn | 👥 ${Object.keys(byCustomer).length} khách

${lines.join("\n")}`;

    bot.sendMessage(chatId, text);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Lỗi: ${err.message}`);
  }
});

// ── /thongke ────────────────────────────────────────────────
bot.onText(/\/thongke/, async (msg) => {
  if (!isAuthorized(msg)) return unauthorized(msg.chat.id);
  const chatId = msg.chat.id;
  try {
    bot.sendChatAction(chatId, "typing");
    const data = await apiGet();
    const orders = data.orders || [];
    const catalog = data.catalog || [];
    const catalogMap = {};
    for (const c of catalog) {
      catalogMap[(c["Mã SP"] || "").trim().toUpperCase()] = c;
    }

    const spCount = {};
    const custCount = {};
    const byStatus = {};
    let totalProfit = 0;

    for (const o of orders) {
      const sp = (o["Mã SP"] || "").trim().toUpperCase();
      const cust = o["Tên khách"] || "?";
      const status = o["TRẠNG THÁI"] || "?";
      const qty = Number(o["Số lượng"]) || 1;

      if (sp) spCount[sp] = (spCount[sp] || 0) + qty;
      custCount[cust] = (custCount[cust] || 0) + 1;
      byStatus[status] = (byStatus[status] || 0) + 1;
      totalProfit += calcProfit(o, catalogMap);
    }

    const topProducts = Object.entries(spCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sp, qty], i) => {
        const cat = catalogMap[sp];
        const name = cat ? ` (${cat["Tên SP"]})` : "";
        return `  ${i + 1}. ${sp}${name}: ${qty} SP`;
      })
      .join("\n");

    const topCustomers = Object.entries(custCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count], i) => `  ${i + 1}. ${name}: ${count} đơn`)
      .join("\n");

    const statusLines = Object.entries(byStatus)
      .sort((a, b) => b[1] - a[1])
      .map(([s, c]) => `  ${statusEmoji(s)} ${s}: ${c}`)
      .join("\n");

    const text = `📊 THỐNG KÊ

📈 Tổng lợi nhuận: ${fmtMoney(Math.round(totalProfit))}

🏆 Top sản phẩm:
${topProducts}

👥 Top khách hàng:
${topCustomers}

📋 Theo trạng thái:
${statusLines}`;

    bot.sendMessage(chatId, text);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Lỗi: ${err.message}`);
  }
});

// ── Free text handler ───────────────────────────────────────
bot.on("message", async (msg) => {
  if (!isAuthorized(msg)) return;
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const text = msg.text.toLowerCase().trim();

  try {
    // Keyword matching
    if (
      text.includes("hôm nay") &&
      (text.includes("đơn") || text.includes("bao nhiêu"))
    ) {
      return handleTodaySummary(chatId);
    }

    if (text.includes("doanh thu")) {
      if (text.includes("tuần")) return handleRevenue(chatId, "week");
      if (text.includes("tháng")) return handleRevenue(chatId, "month");
      if (text.includes("hôm nay")) return handleRevenue(chatId, "today");
      return handleRevenue(chatId, "all");
    }

    if (text.includes("lợi nhuận") || text.includes("profit")) {
      return handleProfit(chatId);
    }

    if (text.includes("nợ") || text.includes("chưa ck") || text.includes("chua ck")) {
      return handleOwing(chatId);
    }

    if (text.includes("chờ gửi") || text.includes("cho gui") || text.includes("về kho") || text.includes("ve kho")) {
      return handleWaiting(chatId);
    }

    if (text.includes("hàng dư") || text.includes("hang du") || text.includes("surplus")) {
      return handleSurplus(chatId);
    }

    if (text.includes("tổng") && text.includes("đơn")) {
      return handleTotalOrders(chatId);
    }

    // If no keyword matches, give a hint
    bot.sendMessage(
      chatId,
      `🤔 Mình chưa hiểu ý bạn. Thử:\n` +
        `• "hôm nay có bao nhiêu đơn"\n` +
        `• "doanh thu tuần này"\n` +
        `• "ai còn nợ"\n` +
        `• "hàng dư"\n` +
        `• /bc để xem báo cáo`
    );
  } catch (err) {
    bot.sendMessage(chatId, `❌ Lỗi: ${err.message}`);
  }
});

// ── Free text handlers ──────────────────────────────────────
async function handleTodaySummary(chatId) {
  bot.sendChatAction(chatId, "typing");
  const data = await apiGet();
  const orders = data.orders || [];
  const today = todayStr();
  const todayOrders = orders.filter((o) => getOrderDate(o) === today);

  let amount = 0;
  for (const o of todayOrders) {
    amount += (Number(o["Giá sp"]) || 0) * (Number(o["Số lượng"]) || 1);
  }

  bot.sendMessage(
    chatId,
    `📅 Hôm nay (${today}): ${todayOrders.length} đơn, doanh thu ${fmtMoney(amount)}`
  );
}

async function handleRevenue(chatId, period) {
  bot.sendChatAction(chatId, "typing");
  const data = await apiGet();
  const orders = data.orders || [];

  let startDate = "";
  let label = "";
  switch (period) {
    case "today":
      startDate = todayStr();
      label = "hôm nay";
      break;
    case "week":
      startDate = thisWeekStart();
      label = "tuần này";
      break;
    case "month":
      startDate = thisMonthStart();
      label = "tháng này";
      break;
    default:
      label = "tổng";
  }

  let amount = 0;
  let count = 0;
  for (const o of orders) {
    const d = getOrderDate(o);
    if (startDate && d < startDate) continue;
    const a = (Number(o["Giá sp"]) || 0) * (Number(o["Số lượng"]) || 1);
    amount += a;
    count++;
  }

  bot.sendMessage(
    chatId,
    `💰 Doanh thu ${label}: ${fmtMoney(amount)} (${fmtNum(count)} đơn)`
  );
}

async function handleProfit(chatId) {
  bot.sendChatAction(chatId, "typing");
  const data = await apiGet();
  const orders = data.orders || [];
  const catalog = data.catalog || [];
  const catalogMap = {};
  for (const c of catalog) {
    catalogMap[(c["Mã SP"] || "").trim().toUpperCase()] = c;
  }

  let totalProfit = 0;
  for (const o of orders) {
    totalProfit += calcProfit(o, catalogMap);
  }

  bot.sendMessage(
    chatId,
    `📈 Tổng lợi nhuận ước tính: ${fmtMoney(Math.round(totalProfit))}`
  );
}

async function handleOwing(chatId) {
  bot.sendChatAction(chatId, "typing");
  const data = await apiGet();
  const orders = data.orders || [];

  const owing = orders.filter(
    (o) => o["TRẠNG THÁI"] === "Đã gửi" && !hasCK(o)
  );

  if (owing.length === 0) {
    return bot.sendMessage(chatId, "🎉 Không có ai nợ!");
  }

  const byCustomer = {};
  for (const o of owing) {
    const name = o["Tên khách"] || "?";
    if (!byCustomer[name]) byCustomer[name] = 0;
    byCustomer[name] +=
      (Number(o["Giá sp"]) || 0) * (Number(o["Số lượng"]) || 1);
  }

  const sorted = Object.entries(byCustomer)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  const lines = sorted
    .map(([name, amt]) => `  💸 ${name}: ${fmtMoney(amt)}`)
    .join("\n");

  bot.sendMessage(
    chatId,
    `💸 ${owing.length} đơn chưa CK, ${Object.keys(byCustomer).length} khách:\n\n${lines}`
  );
}

async function handleWaiting(chatId) {
  bot.sendChatAction(chatId, "typing");
  const data = await apiGet();
  const orders = data.orders || [];

  const waiting = orders.filter((o) => o["TRẠNG THÁI"] === "Về kho");

  if (waiting.length === 0) {
    return bot.sendMessage(chatId, "📭 Không có đơn nào chờ gửi.");
  }

  const byCustomer = {};
  for (const o of waiting) {
    const name = o["Tên khách"] || "?";
    if (!byCustomer[name]) byCustomer[name] = 0;
    byCustomer[name]++;
  }

  const lines = Object.entries(byCustomer)
    .sort((a, b) => b[1] - a[1])
    .map(([name, c]) => `  📦 ${name}: ${c} đơn`)
    .join("\n");

  bot.sendMessage(
    chatId,
    `📦 ${waiting.length} đơn chờ gửi:\n\n${lines}`
  );
}

async function handleSurplus(chatId) {
  bot.sendChatAction(chatId, "typing");
  const data = await apiGet();
  const surplus = data.surplus || [];

  const active = surplus.filter((s) => (Number(s["SL dư"]) || 0) > 0);

  if (active.length === 0) {
    return bot.sendMessage(chatId, "📭 Không có hàng dư.");
  }

  const lines = active.map(
    (s) =>
      `  📦 ${s["Mã SP"]} ${s["Size"]} ${s["Color"]} x${s["SL dư"]} [${s["Trạng thái"]}]`
  );

  bot.sendMessage(
    chatId,
    `📦 Hàng dư: ${active.length} mục\n\n${lines.join("\n")}`
  );
}

async function handleTotalOrders(chatId) {
  bot.sendChatAction(chatId, "typing");
  const data = await apiGet();
  const orders = data.orders || [];

  const byStatus = {};
  for (const o of orders) {
    const s = o["TRẠNG THÁI"] || "?";
    byStatus[s] = (byStatus[s] || 0) + 1;
  }

  const lines = Object.entries(byStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([s, c]) => `  ${statusEmoji(s)} ${s}: ${c}`)
    .join("\n");

  bot.sendMessage(
    chatId,
    `📦 Tổng: ${orders.length} đơn\n\n${lines}`
  );
}

// ── Status emoji helper ─────────────────────────────────────
function statusEmoji(status) {
  const map = {
    "CHƯA ĐẶT": "⬜",
    "Chờ hàng": "🟡",
    "Đang ship": "🚚",
    "Về kho": "📦",
    "Đã gửi": "✅",
    "Đã xoá": "🗑️",
    "Lưu trữ": "📁",
  };
  return map[status] || "❓";
}

// ── Error handling ──────────────────────────────────────────
bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
