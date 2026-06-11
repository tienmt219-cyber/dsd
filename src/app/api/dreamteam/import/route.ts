import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orders = [], stock = [], catalog = [], addresses = {}, surplus = [], emsHistory = [] } = body;
    const addrEntries = Object.entries(addresses);

    await prisma.$transaction(async (tx) => {
      if (orders.length > 0) {
        await tx.dtOrder.deleteMany();
        const seenRows = new Set<number>();
        for (const o of orders) {
          const rowIndex = Number(o._rowIndex ?? o.rowIndex);
          if (!rowIndex && rowIndex !== 0) continue;
          if (seenRows.has(rowIndex)) continue;
          seenRows.add(rowIndex);

          let ngayOd: Date;
          try {
            ngayOd = o["NGÀY OD"] ? new Date(o["NGÀY OD"]) : new Date();
            if (isNaN(ngayOd.getTime())) ngayOd = new Date();
          } catch { ngayOd = new Date(); }

          await tx.dtOrder.create({
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

      if (stock.length > 0) {
        await tx.dtStock.deleteMany();
        for (const s of stock) {
          await tx.dtStock.create({
            data: {
              ma: String(s.ma ?? s["Mã SP"] ?? ""),
              ten: String(s.ten ?? ""),
              size: String(s.size ?? s["Size"] ?? ""),
              color: String(s.color ?? s["Color"] ?? ""),
              soLuong: Number(s.soLuong ?? s["Số lượng nhập"]) || 0,
              ngayNhap: String(s.ngayNhap ?? s["Ngày nhập"] ?? ""),
            },
          });
        }
      }

      if (catalog.length > 0) {
        await tx.dtCatalog.deleteMany();
        for (const c of catalog) {
          const maSP = String(c.maSP ?? c["Mã SP"] ?? "");
          if (!maSP) continue;
          const giaBan = Number(c.giaBan ?? c["Giá bán"]) || 0;
          const giaNhap = Number(c.giaMua ?? c["Giá nhập"]) || 0;
          await tx.dtCatalog.create({
            data: {
              maSP,
              tenSP: String(c.tenSP ?? c["Tên SP"] ?? ""),
              giaBan,
              giaMua: giaNhap,
              loiNhuan: Math.round(giaBan - giaNhap),
              margin: giaBan > 0 && giaNhap > 0 ? (giaBan - giaNhap) / giaBan : 0,
              sizes: String(c.sizes ?? c["Size"] ?? ""),
              colors: String(c.colors ?? c["Màu"] ?? ""),
              daBan: Number(c.daBan ?? c["Đã bán"]) || 0,
              loai: String(c.loai ?? c["Loại"] ?? ""),
              image: String(c.image ?? c["Ảnh"] ?? ""),
            },
          });
        }
      }

      if (addrEntries.length > 0) {
        await tx.dtAddress.deleteMany();
        const seen = new Set<string>();
        for (const [key, val] of addrEntries) {
          if (key.startsWith("fb:")) continue;
          const parts = key.split("|");
          const name = parts[0] ?? "";
          const fb = parts.slice(1).join("|") ?? "";
          const uniqueKey = `${name}|${fb}`;
          if (seen.has(uniqueKey)) continue;
          seen.add(uniqueKey);
          const a = val as Record<string, string>;
          await tx.dtAddress.create({
            data: { name, fb, postal: a.postal ?? "", pref: a.pref ?? "", city: a.city ?? "", street: a.street ?? "", phone: a.phone ?? "" },
          });
        }
      }

      if (surplus.length > 0) {
        await tx.dtSurplus.deleteMany();
        for (const s of surplus) {
          await tx.dtSurplus.create({
            data: {
              ma: String(s.ma ?? s["Mã SP"] ?? ""),
              ten: String(s.ten ?? ""),
              sz: String(s.sz ?? s["Size"] ?? ""),
              cl: String(s.cl ?? s["Color"] ?? ""),
              sl: Number(s.sl ?? s["SL dư"]) || 0,
              trangThai: String(s.trangThai ?? s["Trạng thái"] ?? "Chờ hàng"),
              ngayTao: String(s.ngayTao ?? s["Ngày tạo"] ?? ""),
            },
          });
        }
      }

      if (emsHistory.length > 0) {
        await tx.dtEmsBatch.deleteMany();
        for (const e of emsHistory) {
          await tx.dtEmsBatch.create({
            data: {
              emsCode: e.emsCode ?? "",
              items: typeof e.items === "string" ? e.items : JSON.stringify(e.items ?? []),
              createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
              skuCount: Number(e.skuCount) || 0,
              totalQty: Number(e.totalQty) || 0,
              chiTiet: String(e.detail ?? e.chiTiet ?? ""),
              status: String(e.status ?? "Đã nhập kho"),
              lastCheck: String(e.lastCheck ?? ""),
              trackRaw: String(e.trackRaw ?? ""),
            },
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      imported: {
        orders: orders.length,
        stock: stock.length,
        catalog: catalog.length,
        addresses: addrEntries.filter(([k]: [string, unknown]) => !k.startsWith("fb:")).length,
        surplus: surplus.length,
        emsHistory: emsHistory.length,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
