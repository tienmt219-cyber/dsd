const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const crypto = require("crypto");

const db = new Database(path.join(__dirname, "..", "dev.db"));

function cuid() {
  return crypto.randomBytes(12).toString("hex");
}

async function main() {
  const adminHash = await bcrypt.hash("admin123", 10);
  const staffHash = await bcrypt.hash("staff123", 10);

  const adminId = cuid();
  const staffId = cuid();

  db.prepare(`INSERT OR IGNORE INTO User (id, name, email, password, role, phone, active, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`)
    .run(adminId, "Admin", "admin@fashionpos.vn", adminHash, "admin", "0901234567");

  db.prepare(`INSERT OR IGNORE INTO User (id, name, email, password, role, phone, active, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`)
    .run(staffId, "Nhân viên 1", "staff@fashionpos.vn", staffHash, "staff", "0907654321");

  const categories = [
    { name: "Áo", slug: "ao" },
    { name: "Quần", slug: "quan" },
    { name: "Váy/Đầm", slug: "vay-dam" },
    { name: "Phụ kiện", slug: "phu-kien" },
    { name: "Giày dép", slug: "giay-dep" },
  ];

  const catIds = {};
  for (const cat of categories) {
    const id = cuid();
    db.prepare(`INSERT OR IGNORE INTO Category (id, name, slug, createdAt) VALUES (?, ?, ?, datetime('now'))`)
      .run(id, cat.name, cat.slug);
    const row = db.prepare(`SELECT id FROM Category WHERE slug = ?`).get(cat.slug);
    catIds[cat.slug] = row.id;
  }

  const products = [
    { name: "Áo thun basic", sku: "AT-001", catSlug: "ao", costPrice: 80000, sellPrice: 150000 },
    { name: "Áo sơ mi Oxford", sku: "ASM-001", catSlug: "ao", costPrice: 120000, sellPrice: 250000 },
    { name: "Quần jean slim fit", sku: "QJ-001", catSlug: "quan", costPrice: 150000, sellPrice: 350000 },
    { name: "Quần kaki", sku: "QK-001", catSlug: "quan", costPrice: 130000, sellPrice: 280000 },
    { name: "Đầm suông công sở", sku: "DS-001", catSlug: "vay-dam", costPrice: 180000, sellPrice: 400000 },
    { name: "Túi xách nữ", sku: "TX-001", catSlug: "phu-kien", costPrice: 200000, sellPrice: 450000 },
  ];

  const sizes = ["S", "M", "L", "XL"];
  const colors = ["Đen", "Trắng", "Xanh navy"];

  for (const p of products) {
    const existing = db.prepare(`SELECT id FROM Product WHERE sku = ?`).get(p.sku);
    if (existing) continue;

    const productId = cuid();
    db.prepare(`INSERT INTO Product (id, name, sku, categoryId, costPrice, sellPrice, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`)
      .run(productId, p.name, p.sku, catIds[p.catSlug], p.costPrice, p.sellPrice);

    if (p.catSlug !== "phu-kien") {
      for (const size of sizes) {
        for (const color of colors) {
          const variantId = cuid();
          const variantSku = `${p.sku}-${size}-${color.charAt(0)}`;
          const stock = Math.floor(Math.random() * 20) + 5;
          db.prepare(`INSERT OR IGNORE INTO ProductVariant (id, productId, size, color, sku, costPrice, sellPrice, stock, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`)
            .run(variantId, productId, size, color, variantSku, p.costPrice, p.sellPrice, stock);
        }
      }
    } else {
      const variantId = cuid();
      db.prepare(`INSERT OR IGNORE INTO ProductVariant (id, productId, size, color, sku, costPrice, sellPrice, stock, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`)
        .run(variantId, productId, "FREE", "Đen", `${p.sku}-FREE-D`, p.costPrice, p.sellPrice, 15);
    }
  }

  const customers = [
    { name: "Nguyễn Thị Mai", phone: "0912345678", email: "mai@gmail.com", points: 150, totalSpent: 2500000 },
    { name: "Trần Văn Hùng", phone: "0923456789", email: "hung@gmail.com", points: 80, totalSpent: 1200000 },
    { name: "Lê Thị Hoa", phone: "0934567890", email: null, points: 200, totalSpent: 3500000 },
  ];

  for (const c of customers) {
    const existing = db.prepare(`SELECT id FROM Customer WHERE phone = ?`).get(c.phone);
    if (!existing) {
      const id = cuid();
      db.prepare(`INSERT INTO Customer (id, name, phone, email, points, totalSpent, debt, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`)
        .run(id, c.name, c.phone, c.email, c.points, c.totalSpent);
    }
  }

  const settings = [
    { key: "store_name", value: "Fashion POS" },
    { key: "store_phone", value: "0901234567" },
    { key: "store_address", value: "123 Nguyễn Huệ, Q1, TP.HCM" },
    { key: "points_per_amount", value: "100000" },
  ];

  for (const s of settings) {
    db.prepare(`INSERT OR IGNORE INTO Setting (id, key, value) VALUES (?, ?, ?)`)
      .run(cuid(), s.key, s.value);
  }

  console.log("Seed completed!");
}

main().catch(console.error);
