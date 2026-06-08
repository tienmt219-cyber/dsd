import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@fashionpos.vn" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@fashionpos.vn",
      password: passwordHash,
      role: "admin",
      phone: "0901234567",
    },
  });

  await prisma.user.upsert({
    where: { email: "staff@fashionpos.vn" },
    update: {},
    create: {
      name: "Nhân viên 1",
      email: "staff@fashionpos.vn",
      password: await bcrypt.hash("staff123", 10),
      role: "staff",
      phone: "0907654321",
    },
  });

  const categories = [
    { name: "Áo", slug: "ao" },
    { name: "Quần", slug: "quan" },
    { name: "Váy/Đầm", slug: "vay-dam" },
    { name: "Phụ kiện", slug: "phu-kien" },
    { name: "Giày dép", slug: "giay-dep" },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  const catAo = await prisma.category.findUnique({ where: { slug: "ao" } });
  const catQuan = await prisma.category.findUnique({ where: { slug: "quan" } });
  const catVay = await prisma.category.findUnique({ where: { slug: "vay-dam" } });
  const catPK = await prisma.category.findUnique({ where: { slug: "phu-kien" } });

  if (catAo && catQuan && catVay && catPK) {
    const products = [
      { name: "Áo thun basic", sku: "AT-001", categoryId: catAo.id, costPrice: 80000, sellPrice: 150000 },
      { name: "Áo sơ mi Oxford", sku: "ASM-001", categoryId: catAo.id, costPrice: 120000, sellPrice: 250000 },
      { name: "Quần jean slim fit", sku: "QJ-001", categoryId: catQuan.id, costPrice: 150000, sellPrice: 350000 },
      { name: "Quần kaki", sku: "QK-001", categoryId: catQuan.id, costPrice: 130000, sellPrice: 280000 },
      { name: "Đầm suông công sở", sku: "DS-001", categoryId: catVay.id, costPrice: 180000, sellPrice: 400000 },
      { name: "Túi xách nữ", sku: "TX-001", categoryId: catPK.id, costPrice: 200000, sellPrice: 450000 },
    ];

    const sizes = ["S", "M", "L", "XL"];
    const colors = ["Đen", "Trắng", "Xanh navy"];

    for (const p of products) {
      const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
      if (existing) continue;

      const product = await prisma.product.create({ data: p });

      if (p.categoryId !== catPK.id) {
        for (const size of sizes) {
          for (const color of colors) {
            await prisma.productVariant.create({
              data: {
                productId: product.id,
                size,
                color,
                sku: `${p.sku}-${size}-${color.charAt(0)}`,
                costPrice: p.costPrice,
                sellPrice: p.sellPrice,
                stock: Math.floor(Math.random() * 20) + 5,
              },
            });
          }
        }
      } else {
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            size: "FREE",
            color: "Đen",
            sku: `${p.sku}-FREE-D`,
            costPrice: p.costPrice,
            sellPrice: p.sellPrice,
            stock: 15,
          },
        });
      }
    }
  }

  const customers = [
    { name: "Nguyễn Thị Mai", phone: "0912345678", email: "mai@gmail.com", points: 150, totalSpent: 2500000 },
    { name: "Trần Văn Hùng", phone: "0923456789", email: "hung@gmail.com", points: 80, totalSpent: 1200000 },
    { name: "Lê Thị Hoa", phone: "0934567890", points: 200, totalSpent: 3500000 },
  ];

  for (const c of customers) {
    const existing = await prisma.customer.findUnique({ where: { phone: c.phone! } });
    if (!existing) {
      await prisma.customer.create({ data: c });
    }
  }

  await prisma.setting.upsert({ where: { key: "store_name" }, update: {}, create: { key: "store_name", value: "Fashion POS" } });
  await prisma.setting.upsert({ where: { key: "store_phone" }, update: {}, create: { key: "store_phone", value: "0901234567" } });
  await prisma.setting.upsert({ where: { key: "store_address" }, update: {}, create: { key: "store_address", value: "123 Nguyễn Huệ, Q1, TP.HCM" } });
  await prisma.setting.upsert({ where: { key: "points_per_amount" }, update: {}, create: { key: "points_per_amount", value: "100000" } });

  console.log("Seed completed!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
