#!/usr/bin/env node
/**
 * 🔄 SYNC: Google Sheets API → SQLite (real-time)
 * 
 * Pulls LIVE data from Google Sheets via Apps Script API
 * and re-imports everything into SQLite database.
 * 
 * Usage:
 *   node scripts/sync-from-sheets.mjs          # sync once
 *   node scripts/sync-from-sheets.mjs --cron   # for cron job (quiet output)
 * 
 * Can also be called from VPS cron:
 *   */10 * * * * cd /root/dsd && node scripts/sync-from-sheets.mjs --cron >> /var/log/dsd-sync.log 2>&1
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { writeFileSync } from "fs";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "dev.db");
const quiet = process.argv.includes("--cron");

const API_URL = "https://script.googleusercontent.com/macros/echo?user_content_key=AUkAhnSGEeAOh8OtfGJPXXpbVnyQHbUFzxJlXxGchTCxL8OG6PY_cq4IC_DkfPockkixm9Z9OhipKgRV1hR2A1Wj6KPkKpoLkDx5ILAb_VuDb1DqYmWWuw4QlxKQYLq75lfBfEcRXPeYoyH3ammaxXdnAhZhfH_0Q2IQ1Rewwtb7vEsok31qNYVW7SAbzY3CEXiO_gzWI5n3bw9bnFb-PmkguntAtj1g5pwrOUlpSSyqktVtR1oar5_2No--OvAuqmYRmzLUGq_ZR5rvYh5KgFopHJZcWtaj4A&lib=MEKn2qp3TaaNc9VD-3En2ySxA6asZdEeS";

function log(...args) { if (!quiet) console.log(...args); }
function logAlways(...args) { console.log(new Date().toISOString(), ...args); }

// ── Fetch from Google Sheets API ─────────────────────
log("🔄 Fetching live data from Google Sheets API...");
const startFetch = Date.now();

let data;
try {
  const res = await fetch(API_URL, { 
    signal: AbortSignal.timeout(30000),
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  data = await res.json();
  if (!data.success) throw new Error("API returned success=false");
} catch (err) {
  logAlways("❌ FETCH FAILED:", err.message);
  process.exit(1);
}

const fetchTime = ((Date.now() - startFetch) / 1000).toFixed(1);
log(`✅ Fetched in ${fetchTime}s — Orders: ${data.orders?.length}, CK: ${data.orders?.filter(o => (o._note || "").includes("💰CK")).length}`);

// ── Save backup copy ─────────────────────────────────
const backupPath = path.join(__dirname, "..", "don_latest.json");
writeFileSync(backupPath, JSON.stringify(data), "utf-8");
log(`💾 Saved backup: don_latest.json`);

// ── Import into SQLite ───────────────────────────────
function cuid() { return randomUUID().replace(/-/g, "").slice(0, 25); }
function norm(v) { return String(v ?? "").replace(/\.0$/, "").trim().toUpperCase(); }
function normName(s) { return String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim(); }

function toISOStr(v) {
  if (!v) return new Date().toISOString();
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s).toISOString();
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return new Date().toISOString();
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF");

const startImport = Date.now();

// Clear existing data
const dtTables = ["DtOrder", "DtCatalog", "DtStock", "DtSurplus", "DtAddress", "DtEmsBatch", "DtSetting"];
for (const t of dtTables) {
  try { db.exec(`DELETE FROM "${t}"`); } catch {}
}

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
      o._note || null,
      now, now
    );
    orderCount++;
  }
});
insertOrders();

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

// ── Addresses ─────────────────────────────────────────
const insertAddr = db.prepare(`INSERT INTO "DtAddress" (id, name, fb, postal, pref, city, street, phone, soDon, tongSl, doanhThu, giaTb, linkFb, hang) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
let addrCount = 0;

const insertAddrTx = db.transaction(() => {
  const addrs = data.addresses || {};
  const seenAddr = new Set();
  
  for (const [key, val] of Object.entries(addrs)) {
    if (key.startsWith("fb:")) continue;
    if (key.includes("|")) continue;
    if (key === "#REF!") continue;
    
    const name = normName(key);
    if (!name) continue;
    if (seenAddr.has(name)) continue;
    seenAddr.add(name);
    
    insertAddr.run(
      cuid(), name, String(val.fb ?? ""),
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

// ── Settings ──────────────────────────────────────────
const insertSetting = db.prepare(`INSERT OR REPLACE INTO "DtSetting" (key, value) VALUES (?, ?)`);
const settings = [
  ["bank_info", "💜 PayPay: 09030991196\n\n🇯🇵 GMO あおぞらネット銀行:\n法人営業部(101) 2573738\nド ) キン\n\n🇻🇳 VNĐ:\nTRINH THI PHUONG\nTechcombank\n8109030991196\n(không ghi nội dung CK)"],
  ["admin_emails", "tienmt219@gmail.com,sony26041996@gmail.com"],
  ["ship_gz", "100"],
  ["boss_per_item", "80"],
  ["version", "v4.0.0-live-sync"],
  ["last_sync", new Date().toISOString()],
];
const insertSettingTx = db.transaction(() => {
  for (const [key, value] of settings) insertSetting.run(key, value);
});
insertSettingTx();

db.close();

const importTime = ((Date.now() - startImport) / 1000).toFixed(1);
const ckCount = data.orders.filter(o => (o._note || "").includes("💰CK")).length;
const sentCount = data.orders.filter(o => (o._note || "").includes("📮SENT")).length;

log(`\n🎉 Sync complete! (fetch: ${fetchTime}s, import: ${importTime}s)`);
log(`   Orders: ${orderCount} (💰CK: ${ckCount}, 📮SENT: ${sentCount})`);
log(`   Catalog: ${catCount} | Stock: ${stockCount} | Surplus: ${surplusCount}`);
log(`   Addresses: ${addrCount} | EMS: ${emsCount}`);

logAlways(`✅ SYNC OK — ${orderCount} orders, ${ckCount} CK, ${sentCount} SENT (${fetchTime}s + ${importTime}s)`);
