import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orders = [], stock = [], catalog = [], addresses = {}, surplus = [], emsHistory = [] } = body;

    // ── Import Orders ───────────────────────────────────
    if (orders.length > 0) {
      // Clear existing orders
      await prisma.dtOrder.deleteMany();

      for (const o of orders) {
        const rowIndex = Number(o._rowIndex ?? o.rowIndex);
        if (!rowIndex && rowIndex !== 0) continue;

        let ngayOd: Date;
        try {
          ngayOd = o["NGÀY OD"] ? new Date(o["NGÀY OD"]) : new Date();
          if (isNaN(ngayOd.getTime())) ngayOd = new Date();
        } catch {
          ngayOd = new Date();
        }

        await prisma.dtOrder.create({
          data: {
            rowIndex,
            tenKhach: String(o["Tên khách"] ?? ""),
            tenSp: String(o["Tên Sp"] ?? ""),
            maSP: String(o["Mã SP"] ?? ""),
            size: String(o["SIZE"] ?? ""),
            color: String(o["COLOR"] ?? ""),
            soLuong: Number(o["Số lượng"]) || 1,
            giaSp: Number(o["Giá sp"]) || 0,
            linkFb: String(o["Link fb"] ?? ""),
            trangThai: String(o["TRẠNG THÁI"] ?? "CHƯA ĐẶT"),
            ngayOd,
            note: o["_note"] != null ? String(o["_note"]) : null,
          },
        });
      }
    }

    // ── Import Stock ────────────────────────────────────
    if (stock.length > 0) {
      await prisma.dtStock.deleteMany();
      for (const s of stock) {
        await prisma.dtStock.create({
          data: {
            ma: String(s.ma ?? s["Mã SP"] ?? ""),
            ten: String(s.ten ?? s["Tên SP"] ?? ""),
            size: String(s.size ?? s["SIZE"] ?? ""),
            color: String(s.color ?? s["COLOR"] ?? ""),
            soLuong: Number(s.soLuong ?? s["Số lượng"]) || 0,
            note: s.note ?? null,
          },
        });
      }
    }

    // ── Import Catalog ──────────────────────────────────
    if (catalog.length > 0) {
      await prisma.dtCatalog.deleteMany();
      for (const c of catalog) {
        const maSP = String(c.maSP ?? c["Mã SP"] ?? "");
        if (!maSP) continue;
        await prisma.dtCatalog.create({
          data: {
            maSP,
            tenSP: String(c.tenSP ?? c["Tên SP"] ?? ""),
            giaBan: Number(c.giaBan ?? c["Giá bán"]) || 0,
            giaMua: c.giaMua != null || c["Giá mua"] != null ? Number(c.giaMua ?? c["Giá mua"]) : null,
            link: c.link ?? null,
            image: c.image ?? null,
          },
        });
      }
    }

    // ── Import Addresses ────────────────────────────────
    // addresses comes as an object keyed by "name|fb" or "fb:fb"
    const addrEntries = Object.entries(addresses);
    if (addrEntries.length > 0) {
      await prisma.dtAddress.deleteMany();
      const seen = new Set<string>();

      for (const [key, val] of addrEntries) {
        // Skip "fb:..." lookup keys — only import "name|fb" keys
        if (key.startsWith("fb:")) continue;

        const parts = key.split("|");
        const name = parts[0] ?? "";
        const fb = parts.slice(1).join("|") ?? "";
        const uniqueKey = `${name}|${fb}`;
        if (seen.has(uniqueKey)) continue;
        seen.add(uniqueKey);

        const a = val as Record<string, string>;
        await prisma.dtAddress.create({
          data: {
            name,
            fb,
            postal: a.postal ?? "",
            pref: a.pref ?? "",
            city: a.city ?? "",
            street: a.street ?? "",
            phone: a.phone ?? "",
          },
        });
      }
    }

    // ── Import Surplus ──────────────────────────────────
    if (surplus.length > 0) {
      await prisma.dtSurplus.deleteMany();
      for (const s of surplus) {
        await prisma.dtSurplus.create({
          data: {
            ma: String(s.ma ?? ""),
            ten: String(s.ten ?? ""),
            sz: String(s.sz ?? ""),
            cl: String(s.cl ?? ""),
            sl: Number(s.sl) || 0,
            note: s.note ?? null,
          },
        });
      }
    }

    // ── Import EMS History ──────────────────────────────
    if (emsHistory.length > 0) {
      await prisma.dtEmsBatch.deleteMany();
      for (const e of emsHistory) {
        await prisma.dtEmsBatch.create({
          data: {
            emsCode: e.emsCode ?? "",
            items: typeof e.items === "string" ? e.items : JSON.stringify(e.items ?? []),
            createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      imported: {
        orders: orders.length,
        stock: stock.length,
        catalog: catalog.length,
        addresses: addrEntries.filter(([k]) => !k.startsWith("fb:")).length,
        surplus: surplus.length,
        emsHistory: emsHistory.length,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
