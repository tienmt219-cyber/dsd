#!/usr/bin/env node
/**
 * Migration: don.txt (Google Sheets API JSON) → SQLite (direct better-sqlite3)
 * This imports LIVE data from Google Sheets API including _note (CK, EMS marks)
 * Usage: node scripts/migrate-json.mjs [path/to/don.txt]
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "dev.db");
const jsonPath = process.argv[2] || path.join(__dirname, "..", "don.txt");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF");

function cuid() { return randomUUID().replace(/-/g, "").slice(0, 25); }
function norm(v) { return String(v ?? "").replace(/\.0$/, "").trim().toUpperCase(); }
function normName(s) { return String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim(); }

function toISOStr(v) {
  if (!v) return null; // keep empty dates as NULL, not today
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s).toISOString();
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return null; // unparseable dates → NULL instead of today
}

function normalizeFb(url) {
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";
  const idMatch = s.match(/profile\.php\?.*?id=(\d+)/i);
  if (idMatch) return "id:" + idMatch[1];
  const m = s.match(/^https?:\/\/[^/]+\/(.+?)(?:[?#]|$)/i);
  if (m) {
    const p = m[1].replace(/\/+$/, "");
    const parts = p.split("/").filter(x => x.length);
    if (!parts.length) return "";
    return parts[parts.length - 1].toLowerCase();
  }
  return s.toLowerCase();
}

console.log("📂 Reading:", jsonPath);
const raw = readFileSync(jsonPath, "utf-8");
const data = JSON.parse(raw);
console.log("✅ Parsed JSON successfully");
console.log(`   Orders: ${data.orders?.length || 0}`);
console.log(`   Stock: ${data.stock?.length || 0}`);
console.log(`   Catalog: ${data.catalog?.length || 0}`);
console.log(`   Surplus: ${data.surplus?.length || 0}`);
console.log(`   Addresses: ${Object.keys(data.addresses || {}).length} keys`);
console.log(`   EMS: ${data.emsHistory?.length || 0}`);

// ── Clear existing Dream Team data ────────────────────
const dtTables = ["DtOrder", "DtCatalog", "DtStock", "DtSurplus", "DtAddress", "DtEmsBatch", "DtSetting"];
for (const t of dtTables) {
  try { db.exec(`DELETE FROM "${t}"`); } catch {}
}
console.log("\n🗑 Cleared existing data");

// ── Orders ────────────────────────────────────────────
const insertOrder = db.prepare(`INSERT INTO "DtOrder" (id, rowIndex, tenKhach, tenSp, maSP, size, color, soLuong, giaSp, ngayOd, trangThai, linkFb, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const now = new Date().toISOString();
let orderCount = 0;

const insertOrders = db.transaction(() => {
  for (const o of data.orders) {
    const tenKhach = String(o["Tên khách"] ?? "").trim();
    if (!tenKhach) continue;
    insertOrder.run(
      cuid(),
      o._rowIndex || (orderCount + 2),
      tenKhach,
      String(o["Tên Sp"] ?? ""),
      String(o["Mã SP"] ?? "").trim(),
      String(o["SIZE"] ?? "").trim(),
      String(o["COLOR"] ?? "").trim(),
      Number(o["Số lượng"]) || 1,
      Number(o["Giá sp"]) || 0,
      toISOStr(o["NGÀY OD"]),
      String(o["TRẠNG THÁI"] ?? "CHƯA ĐẶT").trim(),
      String(o["Link fb"] ?? ""),
      o._note || null,  // ★ CRITICAL: preserve 💰CK, 📮SENT marks
      now, now
    );
    orderCount++;
  }
});
insertOrders();
console.log(`✅ Orders: ${orderCount}`);

// ── Catalog ───────────────────────────────────────────
const insertCat = db.prepare(`INSERT INTO "DtCatalog" (id, maSP, tenSP, giaBan, giaMua, loiNhuan, margin, sizes, colors, daBan, loai, image, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
let catCount = 0;
const seenSP = new Set();

const insertCatalog = db.transaction(() => {
  for (const r of (data.catalog || [])) {
    const maSP = norm(r["Mã SP"]);
    if (!maSP || seenSP.has(maSP)) continue;
    seenSP.add(maSP);
    const giaBan = Number(r["Giá bán"]) || 0;
    const giaNhap = Number(r["Giá nhập"]) || 0;
    insertCat.run(
      cuid(), maSP,
      String(r["Tên SP"] ?? ""),
      giaBan, giaNhap,
      Math.round(giaBan - giaNhap),
      giaBan > 0 && giaNhap > 0 ? (giaBan - giaNhap) / giaBan : 0,
      String(r["Size"] ?? r["SIZE"] ?? ""),
      String(r["Màu"] ?? r["Mau"] ?? ""),
      Number(r["Đã bán"]) || 0,
      String(r["Loại"] ?? ""),
      String(r["Ảnh"] ?? ""),
      null
    );
    catCount++;
  }
});
insertCatalog();
console.log(`✅ Catalog: ${catCount}`);

// ── Stock ─────────────────────────────────────────────
const insertStock = db.prepare(`INSERT INTO "DtStock" (id, ma, ten, size, color, soLuong, ngayNhap, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
let stockCount = 0;

const insertStockTx = db.transaction(() => {
  for (const r of (data.stock || [])) {
    const ma = norm(r["Mã SP"]);
    if (!ma) continue;
    insertStock.run(
      cuid(), ma, "",
      norm(r["Size"] ?? r["SIZE"] ?? ""),
      norm(r["Color"] ?? r["COLOR"] ?? ""),
      Number(r["Số lượng nhập"]) || 0,
      String(r["Ngày nhập"] ?? ""),
      null
    );
    stockCount++;
  }
});
insertStockTx();
console.log(`✅ Stock: ${stockCount}`);

// ── Surplus ───────────────────────────────────────────
const insertSurplus = db.prepare(`INSERT INTO "DtSurplus" (id, ma, ten, sz, cl, sl, trangThai, ngayTao, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
let surplusCount = 0;

const insertSurplusTx = db.transaction(() => {
  for (const r of (data.surplus || [])) {
    const ma = norm(r["Mã SP"]);
    if (!ma) continue;
    insertSurplus.run(
      cuid(), ma, "",
      norm(r["Size"] ?? ""),
      norm(r["Color"] ?? ""),
      Number(r["SL dư"]) || 0,
      String(r["Trạng thái"] ?? "Chờ hàng").trim(),
      String(r["Ngày tạo"] ?? ""),
      null
    );
    surplusCount++;
  }
});
insertSurplusTx();
console.log(`✅ Surplus: ${surplusCount}`);

// ── Addresses ─────────────────────────────────────────
// Google Sheets API returns addresses as dict with keys: "name", "fb:xxx", "name|fbkey"
// We need to extract unique addresses and store in DtAddress table
const insertAddr = db.prepare(`INSERT INTO "DtAddress" (id, name, fb, postal, pref, city, street, phone, soDon, tongSl, doanhThu, giaTb, linkFb, hang) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
let addrCount = 0;

const insertAddrTx = db.transaction(() => {
  const addrs = data.addresses || {};
  const seenAddr = new Set();
  
  // Only process plain name keys and name|fb keys (skip fb: keys to avoid duplicates)
  for (const [key, val] of Object.entries(addrs)) {
    if (key.startsWith("fb:")) continue; // skip fb-only keys
    if (key.includes("|")) continue; // skip composite keys
    if (key === "#REF!") continue; // skip error keys
    
    const name = normName(key);
    if (!name) continue;
    if (seenAddr.has(name)) continue;
    seenAddr.add(name);
    
    const fb = String(val.fb ?? "");
    
    insertAddr.run(
      cuid(), name, fb,
      String(val.postal ?? ""),
      String(val.pref ?? ""),
      String(val.city ?? ""),
      String(val.street ?? ""),
      String(val.phone ?? ""),
      0, 0, 0, 0, "", ""
    );
    addrCount++;
  }
});
insertAddrTx();
console.log(`✅ Addresses: ${addrCount}`);

// ── EMS History ───────────────────────────────────────
const insertEms = db.prepare(`INSERT INTO "DtEmsBatch" (id, emsCode, createdAt, items, skuCount, totalQty, chiTiet, status, lastCheck, trackRaw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
let emsCount = 0;

const insertEmsTx = db.transaction(() => {
  for (const r of (data.emsHistory || [])) {
    const code = String(r.emsCode ?? "").trim();
    if (!code) continue;
    
    let items = "[]";
    if (r.items) {
      if (typeof r.items === "string") {
        try { JSON.parse(r.items); items = r.items; } catch { items = "[]"; }
      } else {
        items = JSON.stringify(r.items);
      }
    }
    
    insertEms.run(
      cuid(), code,
      toISOStr(r.date),
      items,
      Number(r.skuCount) || 0,
      Number(r.totalQty) || 0,
      String(r.detail ?? ""),
      String(r.status ?? "Đã nhập kho").trim(),
      String(r.lastCheck ?? ""),
      String(r.trackRaw ?? "")
    );
    emsCount++;
  }
});
insertEmsTx();
console.log(`✅ EMS History: ${emsCount}`);

// ── Settings ──────────────────────────────────────────
const insertSetting = db.prepare(`INSERT OR REPLACE INTO "DtSetting" (key, value) VALUES (?, ?)`);
const settings = [
  ["bank_info", "💜 PayPay: 09030991196\n\n🇯🇵 GMO あおぞらネット銀行:\n法人営業部(101) 2573738\nド ) キン\n\n🇻🇳 VNĐ:\nTRINH THI PHUONG\nTechcombank\n8109030991196\n(không ghi nội dung CK)"],
  ["admin_emails", "tienmt219@gmail.com,sony26041996@gmail.com"],
  ["ship_gz", "100"],
  ["boss_per_item", "80"],
  ["version", "v4.0.0-json-import"],
];
const insertSettingTx = db.transaction(() => {
  for (const [key, value] of settings) insertSetting.run(key, value);
});
insertSettingTx();
console.log(`✅ Settings: ${settings.length}`);

// ── Summary ───────────────────────────────────────────
const ckCount = data.orders.filter(o => (o._note || "").includes("💰CK")).length;
const sentCount = data.orders.filter(o => (o._note || "").includes("📮SENT")).length;

console.log("\n🎉 Migration complete!");
console.log(`   Orders: ${orderCount} (with ${ckCount} CK marks, ${sentCount} SENT marks)`);
console.log(`   Catalog: ${catCount}`);
console.log(`   Stock: ${stockCount}`);
console.log(`   Surplus: ${surplusCount}`);
console.log(`   Addresses: ${addrCount}`);
console.log(`   EMS: ${emsCount}`);

db.close();
