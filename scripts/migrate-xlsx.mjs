#!/usr/bin/env node
/**
 * Migration: mydream.xlsx → SQLite (direct better-sqlite3)
 * Usage: node scripts/migrate-xlsx.mjs [path/to/mydream.xlsx]
 */
import XLSX from "xlsx";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "dev.db");
const xlsxPath = process.argv[2] || path.join(__dirname, "..", "mydream.xlsx");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF");

function cuid() { return randomUUID().replace(/-/g, "").slice(0, 25); }
function norm(v) { return String(v ?? "").replace(/\.0$/, "").trim().toUpperCase(); }
function normName(s) { return String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim(); }

function safeStr(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return "";
  if (/GMT[+-]\d/.test(s)) return "";
  if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s/.test(s)) return "";
  return s;
}

function toDateStr(v) {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const n = Number(v);
  if (!isNaN(n) && n > 30000 && n < 60000) {
    const d = XLSX.SSF.parse_date_code(n);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {}
  return "";
}

function toISOStr(v) {
  const ds = toDateStr(v);
  if (!ds) return new Date().toISOString();
  return new Date(ds).toISOString();
}

function toInt(v) {
  if (v === null || v === undefined || v === "") return 0;
  return Math.round(Number(v)) || 0;
}

function toFloat(v) {
  if (v === null || v === undefined || v === "") return 0;
  return Number(v) || 0;
}

function readSheet(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) { console.log(`  ⚠ Sheet "${name}" not found`); return []; }
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

console.log("📂 Reading:", xlsxPath);
const wb = XLSX.readFile(xlsxPath);
console.log("📋 Sheets:", wb.SheetNames.join(", "));

// ── Clear existing Dream Team data ────────────────────
const dtTables = ["DtOrder", "DtCatalog", "DtStock", "DtSurplus", "DtAddress", "DtEmsBatch", "DtSetting"];
for (const t of dtTables) {
  try { db.exec(`DELETE FROM "${t}"`); } catch {}
}

// ── Orders (NHẬP ĐƠN) ────────────────────────────────
const insertOrder = db.prepare(`INSERT INTO "DtOrder" (id, rowIndex, tenKhach, tenSp, maSP, size, color, soLuong, giaSp, ngayOd, trangThai, linkFb, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const ordersRaw = readSheet(wb, "NHẬP ĐƠN");
let orderCount = 0;
const now = new Date().toISOString();

const insertOrders = db.transaction(() => {
  for (let i = 0; i < ordersRaw.length; i++) {
    const r = ordersRaw[i];
    const tenKhach = normName(r["Tên khách"]);
    if (!tenKhach) continue;
    insertOrder.run(
      cuid(), i + 2, tenKhach,
      String(r["Tên Sp"] ?? ""),
      norm(r["Mã SP"] ?? r["MÃ SP"] ?? ""),
      norm(r["SIZE"] ?? r["Size"] ?? ""),
      norm(r["COLOR"] ?? r["Color"] ?? ""),
      toInt(r["Số lượng"]),
      toFloat(r["Giá sp"]),
      toISOStr(r["NGÀY OD"]),
      String(r["TRẠNG THÁI"] ?? "CHƯA ĐẶT").trim(),
      String(r["Link fb"] ?? ""),
      null, now, now
    );
    orderCount++;
  }
});
insertOrders();
console.log(`✅ Orders (NHẬP ĐƠN): ${orderCount}`);

// ── Archived orders (LỊCH SỬ) ────────────────────────
const archiveRaw = readSheet(wb, "LỊCH SỬ");
let archiveCount = 0;
const lastIdx = orderCount + 1;

const insertArchive = db.transaction(() => {
  for (let i = 0; i < archiveRaw.length; i++) {
    const r = archiveRaw[i];
    const tenKhach = normName(r["Tên khách"]);
    if (!tenKhach) continue;
    insertOrder.run(
      cuid(), lastIdx + i + 1, tenKhach,
      String(r["Tên Sp"] ?? ""),
      norm(r["Mã SP"] ?? ""),
      norm(r["SIZE"] ?? r["Size"] ?? ""),
      norm(r["COLOR"] ?? r["Color"] ?? ""),
      toInt(r["Số lượng"]),
      toFloat(r["Giá sp"]),
      toISOStr(r["NGÀY OD"]),
      "Lưu trữ",
      String(r["Link fb"] ?? ""),
      null, now, now
    );
    archiveCount++;
  }
});
insertArchive();
console.log(`✅ Archive (LỊCH SỬ): ${archiveCount}`);

// ── Catalog ───────────────────────────────────────────
const insertCat = db.prepare(`INSERT INTO "DtCatalog" (id, maSP, tenSP, giaBan, giaMua, loiNhuan, margin, sizes, colors, daBan, loai, image, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const catRaw = readSheet(wb, "CATALOG");
let catCount = 0;
const seenSP = new Set();

const insertCatalog = db.transaction(() => {
  for (const r of catRaw) {
    const maSP = norm(r["Mã SP"]);
    if (!maSP || seenSP.has(maSP)) continue;
    seenSP.add(maSP);
    const giaBan = toFloat(r["Giá bán"]);
    const giaNhap = toFloat(r["Giá nhập"]);
    insertCat.run(
      cuid(), maSP,
      String(r["Tên SP"] ?? ""),
      giaBan, giaNhap,
      toInt(giaBan - giaNhap),
      giaBan > 0 && giaNhap > 0 ? (giaBan - giaNhap) / giaBan : 0,
      safeStr(r["Size"] ?? r["SIZE"] ?? ""),
      safeStr(r["Màu"] ?? r["Mau"] ?? ""),
      toInt(r["Đã bán"]),
      safeStr(r["Loại"] ?? ""),
      safeStr(r["Ảnh"] ?? ""),
      null
    );
    catCount++;
  }
});
insertCatalog();
console.log(`✅ Catalog: ${catCount}`);

// ── Stock (KHO HÀNG) ─────────────────────────────────
const insertStock = db.prepare(`INSERT INTO "DtStock" (id, ma, ten, size, color, soLuong, ngayNhap, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
const stockRaw = readSheet(wb, "KHO HÀNG");
let stockCount = 0;

const insertStockTx = db.transaction(() => {
  for (const r of stockRaw) {
    const ma = norm(r["Mã SP"]);
    if (!ma) continue;
    insertStock.run(
      cuid(), ma, "",
      norm(r["Size"] ?? r["SIZE"] ?? ""),
      norm(r["Color"] ?? r["COLOR"] ?? ""),
      toInt(r["Số lượng nhập"]),
      toDateStr(r["Ngày nhập"]),
      null
    );
    stockCount++;
  }
});
insertStockTx();
console.log(`✅ Stock (KHO HÀNG): ${stockCount}`);

// ── Surplus (HÀNG DƯ) ────────────────────────────────
const insertSurplus = db.prepare(`INSERT INTO "DtSurplus" (id, ma, ten, sz, cl, sl, trangThai, ngayTao, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const surplusRaw = readSheet(wb, "HÀNG DƯ");
let surplusCount = 0;

const insertSurplusTx = db.transaction(() => {
  for (const r of surplusRaw) {
    const ma = norm(r["Mã SP"]);
    if (!ma) continue;
    insertSurplus.run(
      cuid(), ma, "",
      norm(r["Size"] ?? ""),
      norm(r["Color"] ?? ""),
      toInt(r["SL dư"]),
      String(r["Trạng thái"] ?? "Chờ hàng").trim(),
      toDateStr(r["Ngày tạo"]),
      null
    );
    surplusCount++;
  }
});
insertSurplusTx();
console.log(`✅ Surplus (HÀNG DƯ): ${surplusCount}`);

// ── Addresses (KHÁCH HÀNG) ───────────────────────────
const colMap = {};
const ws = wb.Sheets["KHÁCH HÀNG"];
let addrCount = 0;
if (ws) {
  const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
  console.log(`  📋 KHÁCH HÀNG headers: ${headers.map((h, i) => `${i}:${h}`).join(", ")}`);

  const addrRaw = readSheet(wb, "KHÁCH HÀNG");
  const seenAddr = new Set();

  const insertAddr = db.prepare(`INSERT INTO "DtAddress" (id, name, fb, postal, pref, city, street, phone, soDon, tongSl, doanhThu, giaTb, linkFb, hang) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const insertAddrTx = db.transaction(() => {
    for (const r of addrRaw) {
      const rawName = Object.values(r)[0];
      const name = normName(rawName);
      if (!name) continue;
      if (String(rawName).includes("#REF")) continue;

      const keys = Object.keys(r);
      const postal = safeStr(r[keys[7]] ?? r["〒"] ?? "");
      const pref = safeStr(r[keys[8]] ?? r["都道府県"] ?? "");
      const city = safeStr(r[keys[9]] ?? r["市区町村"] ?? "");
      const street = safeStr(r[keys[10]] ?? r["番地"] ?? "");
      const phone = safeStr(r[keys[11]] ?? r["電話"] ?? "");
      const fb = safeStr(r[keys[12]] ?? r["Link FB"] ?? "");

      if (!postal && !pref && !city && !street && !phone) continue;

      const key = `${name}|${fb}`;
      if (seenAddr.has(key)) continue;
      seenAddr.add(key);

      insertAddr.run(
        cuid(), name, fb,
        postal, pref, city, street, phone,
        toInt(r[keys[1]] ?? 0),
        toInt(r[keys[2]] ?? 0),
        toInt(r[keys[3]] ?? 0),
        toInt(r[keys[4]] ?? 0),
        safeStr(r[keys[5]] ?? ""),
        safeStr(r[keys[6]] ?? "")
      );
      addrCount++;
    }
  });
  insertAddrTx();
}
console.log(`✅ Addresses (KHÁCH HÀNG): ${addrCount}`);

// ── EMS History ───────────────────────────────────────
const insertEms = db.prepare(`INSERT INTO "DtEmsBatch" (id, emsCode, createdAt, items, skuCount, totalQty, chiTiet, status, lastCheck, trackRaw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const emsRaw = readSheet(wb, "LỊCH SỬ EMS");
let emsCount = 0;

const insertEmsTx = db.transaction(() => {
  for (const r of emsRaw) {
    const code = String(r["Mã EMS"] ?? "").trim();
    if (!code) continue;

    let items = "[]";
    try {
      const jsonStr = String(r["JSON"] ?? "");
      if (jsonStr) { JSON.parse(jsonStr); items = jsonStr; }
    } catch {}

    const dateStr = toDateStr(r["Ngày"]);

    insertEms.run(
      cuid(), code,
      dateStr ? new Date(dateStr).toISOString() : now,
      items,
      toInt(r["Số SKU"]),
      toInt(r["Tổng SL"]),
      String(r["Chi tiết"] ?? ""),
      String(r["Status"] ?? "Đã nhập kho").trim(),
      safeStr(r["Last Check"] ?? ""),
      safeStr(r["17track Raw"] ?? "")
    );
    emsCount++;
  }
});
insertEmsTx();
console.log(`✅ EMS History: ${emsCount}`);

// ── Settings ──────────────────────────────────────────
const insertSetting = db.prepare(`INSERT INTO "DtSetting" (key, value) VALUES (?, ?)`);
const settings = [
  ["bank_info", "💜 PayPay: 09030991196\n\n🇯🇵 GMO あおぞらネット銀行:\n法人営業部(101) 2573738\nド ) キン\n\n🇻🇳 VNĐ:\nTRINH THI PHUONG\nTechcombank\n8109030991196\n(không ghi nội dung CK)"],
  ["admin_emails", "tienmt219@gmail.com,sony26041996@gmail.com"],
  ["ship_gz", "100"],
  ["boss_per_item", "80"],
  ["version", "v4.0.0-sqlite"],
];
const insertSettingTx = db.transaction(() => {
  for (const [key, value] of settings) insertSetting.run(key, value);
});
insertSettingTx();
console.log(`✅ Settings: ${settings.length}`);

// ── Summary ───────────────────────────────────────────
console.log("\n🎉 Migration complete!");
console.log(`   Orders: ${orderCount} + ${archiveCount} archived = ${orderCount + archiveCount}`);
console.log(`   Catalog: ${catCount}`);
console.log(`   Stock: ${stockCount}`);
console.log(`   Surplus: ${surplusCount}`);
console.log(`   Addresses: ${addrCount}`);
console.log(`   EMS: ${emsCount}`);

db.close();
