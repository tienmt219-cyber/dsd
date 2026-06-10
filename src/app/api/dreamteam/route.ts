import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── helpers ──────────────────────────────────────────────────

function normalizeFb(raw: string): string {
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (url.hostname.includes("facebook.com") || url.hostname.includes("fb.com")) {
      if (url.pathname.includes("/profile.php")) {
        const id = url.searchParams.get("id");
        return id ? `id:${id}` : raw.toLowerCase();
      }
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length > 0) {
        return segments[segments.length - 1].toLowerCase();
      }
    }
  } catch {
    // not a valid URL – return as-is lowercase
  }
  return raw.toLowerCase();
}

function buildAddressMap(addresses: Array<{ name: string; fb: string; postal: string; pref: string; city: string; street: string; phone: string }>) {
  const map: Record<string, { postal: string; pref: string; city: string; street: string; phone: string }> = {};
  for (const a of addresses) {
    const nfb = normalizeFb(a.fb);
    const data = { postal: a.postal, pref: a.pref, city: a.city, street: a.street, phone: a.phone };
    map[`${a.name}|${nfb}`] = data;
    if (nfb) map[`fb:${nfb}`] = data;
  }
  return map;
}

async function getFullData() {
  const [orders, stock, catalog, addresses, surplus, emsBatches] = await Promise.all([
    prisma.dtOrder.findMany({ where: { trangThai: { not: "Đã xoá" } }, orderBy: { rowIndex: "asc" } }),
    prisma.dtStock.findMany(),
    prisma.dtCatalog.findMany(),
    prisma.dtAddress.findMany(),
    prisma.dtSurplus.findMany(),
    prisma.dtEmsBatch.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return {
    success: true,
    orders: orders.map((o) => ({
      _rowIndex: o.rowIndex,
      "Tên khách": o.tenKhach,
      "Tên Sp": o.tenSp,
      "Mã SP": o.maSP,
      "SIZE": o.size,
      "COLOR": o.color,
      "Số lượng": o.soLuong,
      "Giá sp": o.giaSp,
      "Link fb": o.linkFb,
      "TRẠNG THÁI": o.trangThai,
      "NGÀY OD": o.ngayOd.toISOString().slice(0, 10),
      "_note": o.note,
    })),
    stock: stock.map((s) => ({
      id: s.id,
      "Mã SP": s.ma,
      "Size": s.size,
      "Color": s.color,
      "Số lượng nhập": s.soLuong,
      "Số lượng": s.soLuong,
      "Ngày nhập": "",
      note: s.note,
    })),
    catalog: catalog.map((c) => ({
      id: c.id,
      "Mã SP": c.maSP,
      "Tên SP": c.tenSP,
      "Giá bán": c.giaBan,
      "Giá nhập": c.giaMua,
      link: c.link,
      image: c.image,
    })),
    addresses: buildAddressMap(addresses),
    surplus: surplus.map((s) => ({
      id: s.id,
      "Mã SP": s.ma,
      "Size": s.sz,
      "Color": s.cl,
      "SL dư": s.sl,
      "Trạng thái": s.note ?? "",
    })),
    emsHistory: emsBatches.map((b, index) => ({
      id: b.id,
      _rowIndex: index,
      date: b.createdAt.toISOString().slice(0, 10),
      emsCode: b.emsCode,
      createdAt: b.createdAt,
      items: JSON.parse(b.items),
    })),
  };
}

async function nextRowIndex(): Promise<number> {
  const last = await prisma.dtOrder.findFirst({ orderBy: { rowIndex: "desc" } });
  return last ? last.rowIndex + 1 : 1;
}

function safeDate(v: unknown): Date {
  try {
    const d = new Date(v as string);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── GET ──────────────────────────────────────────────────────

export async function GET() {
  try {
    const data = await getFullData();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      // ── Orders ──────────────────────────────────────────
      case "addOrder": {
        const o = body.order ?? body;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const ri = await nextRowIndex();
            await prisma.dtOrder.create({
              data: {
                rowIndex: ri,
                tenKhach: String(o.tenKhach ?? ""),
                tenSp: String(o.tenSp ?? ""),
                maSP: String(o.maSP ?? ""),
                size: String(o.size ?? ""),
                color: String(o.color ?? ""),
                soLuong: Number(o.soLuong) || 1,
                giaSp: Number(o.giaSp) || 0,
                linkFb: String(o.linkFb ?? ""),
                trangThai: "CHƯA ĐẶT",
                ngayOd: o.ngayOd ? safeDate(o.ngayOd) : new Date(),
              },
            });
            break;
          } catch (err: unknown) {
            const isUniqueConstraint = err instanceof Error && (err.message.includes("Unique constraint") || err.message.includes("P2002"));
            if (!isUniqueConstraint || attempt === 2) throw err;
          }
        }
        break;
      }

      case "addBatchOrders": {
        const orders: Array<Record<string, unknown>> = body.orders ?? [];
        for (const o of orders) {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const ri = await nextRowIndex();
              await prisma.dtOrder.create({
                data: {
                  rowIndex: ri,
                  tenKhach: String(o.tenKhach ?? ""),
                  tenSp: String(o.tenSp ?? ""),
                  maSP: String(o.maSP ?? ""),
                  size: String(o.size ?? ""),
                  color: String(o.color ?? ""),
                  soLuong: Number(o.soLuong) || 1,
                  giaSp: Number(o.giaSp) || 0,
                  linkFb: String(o.linkFb ?? ""),
                  trangThai: "CHƯA ĐẶT",
                  ngayOd: o.ngayOd ? safeDate(o.ngayOd) : new Date(),
                },
              });
              break;
            } catch (err: unknown) {
              const isUniqueConstraint = err instanceof Error && (err.message.includes("Unique constraint") || err.message.includes("P2002"));
              if (!isUniqueConstraint || attempt === 2) throw err;
            }
          }
        }
        break;
      }

      case "editOrder": {
        const f = body.fields ?? body;
        const updateData: Record<string, unknown> = {};
        if (f.tenKhach !== undefined) updateData.tenKhach = f.tenKhach;
        if (f.tenSp !== undefined) updateData.tenSp = f.tenSp;
        if (f.maSP !== undefined) updateData.maSP = f.maSP;
        if (f.size !== undefined) updateData.size = f.size;
        if (f.color !== undefined) updateData.color = f.color;
        if (f.soLuong !== undefined) updateData.soLuong = Number(f.soLuong);
        if (f.giaSp !== undefined) updateData.giaSp = Number(f.giaSp);
        if (f.linkFb !== undefined) updateData.linkFb = f.linkFb;
        if (f.note !== undefined) updateData.note = f.note;
        if (f.ngayOd !== undefined) updateData.ngayOd = new Date(f.ngayOd);
        await prisma.dtOrder.update({ where: { rowIndex: Number(body.rowIndex) }, data: updateData });
        break;
      }

      case "updateStatus": {
        await prisma.dtOrder.update({
          where: { rowIndex: Number(body.rowIndex) },
          data: { trangThai: body.newStatus ?? body.status },
        });
        break;
      }

      case "softDelete":
      case "deleteOrder": {
        await prisma.dtOrder.update({
          where: { rowIndex: Number(body.rowIndex) },
          data: { trangThai: "Đã xoá" },
        });
        break;
      }

      case "batchMarkCK": {
        const items: Array<Record<string, unknown>> = body.items ?? [];
        const rows: number[] = items.length > 0
          ? items.map((i) => Number(i.rowIndex))
          : (body.rowIndexes ?? []).map(Number);
        const stamp = `💰CK ${todayStr()}`;
        for (const ri of rows) {
          const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
          if (!order) continue;
          const existing = order.note ?? "";
          if (existing.includes("💰CK")) continue;
          const newNote = existing ? `${existing} ${stamp}` : stamp;
          await prisma.dtOrder.update({ where: { rowIndex: ri }, data: { note: newNote } });
        }
        break;
      }

      case "batchUnmarkCK": {
        const items: Array<Record<string, unknown>> = body.items ?? [];
        const rows: number[] = items.length > 0
          ? items.map((i) => Number(i.rowIndex))
          : (body.rowIndexes ?? []).map(Number);
        for (const ri of rows) {
          const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
          if (!order) continue;
          const cleaned = (order.note ?? "").replace(/\s*💰CK\s*\d{4}-\d{2}-\d{2}/g, "").trim();
          await prisma.dtOrder.update({ where: { rowIndex: ri }, data: { note: cleaned || null } });
        }
        break;
      }

      case "shipItems": {
        const items: Array<Record<string, unknown>> = body.items ?? [];
        const rows: number[] = items.length > 0
          ? items.map((i) => Number(i.rowIndex))
          : (body.rowIndexes ?? []).map(Number);
        const stamp = `📮SENT ${todayStr()}`;
        for (const ri of rows) {
          const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
          if (!order) continue;
          const existing = order.note ?? "";
          if (existing.includes("📮SENT")) {
            await prisma.dtOrder.update({
              where: { rowIndex: ri },
              data: { trangThai: "Đã gửi" },
            });
          } else {
            const newNote = existing ? `${existing} ${stamp}` : stamp;
            await prisma.dtOrder.update({
              where: { rowIndex: ri },
              data: { trangThai: "Đã gửi", note: newNote },
            });
          }
        }
        break;
      }

      // ── Address ─────────────────────────────────────────
      case "saveAddress": {
        const addr = body.address ?? body;
        const postal = addr.postal ?? "";
        const pref = addr.pref ?? "";
        const city = addr.city ?? "";
        const street = addr.street ?? "";
        const phone = addr.phone ?? "";
        await prisma.dtAddress.upsert({
          where: { name_fb: { name: body.name, fb: body.fb } },
          create: { name: body.name, fb: body.fb, postal, pref, city, street, phone },
          update: { postal, pref, city, street, phone },
        });
        break;
      }

      // ── Catalog ─────────────────────────────────────────
      case "addCatalog": {
        await prisma.dtCatalog.create({
          data: {
            maSP: body.maSP,
            tenSP: body.tenSP ?? "",
            giaBan: Number(body.giaBan) || 0,
            giaMua: body.giaMua != null ? Number(body.giaMua) : null,
            link: body.link ?? null,
            image: body.image ?? null,
          },
        });
        break;
      }

      case "editCatalog": {
        const updateData: Record<string, unknown> = {};
        if (body.tenSP !== undefined) updateData.tenSP = body.tenSP;
        if (body.giaBan !== undefined) updateData.giaBan = Number(body.giaBan);
        if (body.giaMua !== undefined) updateData.giaMua = body.giaMua != null ? Number(body.giaMua) : null;
        if (body.link !== undefined) updateData.link = body.link;
        if (body.image !== undefined) updateData.image = body.image;
        await prisma.dtCatalog.update({ where: { maSP: body.maSP }, data: updateData });
        break;
      }

      case "deleteCatalog": {
        await prisma.dtCatalog.delete({ where: { maSP: body.maSP } });
        break;
      }

      // ── Stock ───────────────────────────────────────────
      case "addStock": {
        const s = body.item ?? body;
        await prisma.dtStock.create({
          data: {
            ma: String(s.maSP ?? s.ma ?? ""),
            ten: String(s.ten ?? ""),
            size: String(s.size ?? ""),
            color: String(s.color ?? ""),
            soLuong: Number(s.soLuong) || 0,
            note: s.note ?? null,
          },
        });
        break;
      }

      case "editStock": {
        const updateData: Record<string, unknown> = {};
        if (body.ma !== undefined) updateData.ma = body.ma;
        if (body.ten !== undefined) updateData.ten = body.ten;
        if (body.size !== undefined) updateData.size = body.size;
        if (body.color !== undefined) updateData.color = body.color;
        if (body.soLuong !== undefined) updateData.soLuong = Number(body.soLuong);
        if (body.note !== undefined) updateData.note = body.note;
        await prisma.dtStock.update({ where: { id: body.id }, data: updateData });
        break;
      }

      case "deleteStock": {
        await prisma.dtStock.delete({ where: { id: body.id } });
        break;
      }

      // ── EMS ─────────────────────────────────────────────
      case "createEmsBatch": {
        await prisma.dtEmsBatch.create({
          data: {
            emsCode: body.emsCode,
            items: JSON.stringify(body.items ?? []),
          },
        });
        break;
      }

      case "bulkUpdateStatus": {
        const items: Array<Record<string, unknown>> = body.items ?? [];
        for (const item of items) {
          await prisma.dtOrder.update({
            where: { rowIndex: Number(item.rowIndex) },
            data: { trangThai: String(item.newStatus ?? item.status ?? "") },
          });
        }
        break;
      }

      case "addSurplus": {
        await prisma.dtSurplus.create({
          data: {
            ma: String(body.maSP ?? ""),
            ten: "",
            sz: String(body.size ?? ""),
            cl: String(body.color ?? ""),
            sl: Number(body.qty) || 0,
            note: body.status ?? body.note ?? null,
          },
        });
        break;
      }

      case "shipEMSWithStock": {
        const ems = body.ems ?? body;
        const emsItems: Array<Record<string, unknown>> = ems.items ?? [];
        await prisma.dtEmsBatch.create({
          data: {
            emsCode: String(ems.emsCode ?? ""),
            items: JSON.stringify(emsItems),
          },
        });
        for (const item of emsItems) {
          const ma = String(item.ma ?? item.maSP ?? item.sku ?? "");
          const size = String(item.size ?? item.sz ?? "");
          const color = String(item.color ?? item.cl ?? "");
          const qty = Number(item.qty ?? item.soLuong ?? 0);
          if (ma && qty > 0) {
            await prisma.dtStock.create({
              data: { ma, ten: String(item.ten ?? ""), size, color, soLuong: qty },
            });
          }
        }
        break;
      }

      case "editEMSHistory": {
        const ems = body.ems ?? body;
        let targetId: string | undefined = body.id ?? ems.id;
        if (!targetId) {
          const batches = await prisma.dtEmsBatch.findMany({ orderBy: { createdAt: "desc" } });
          const idx = Number(body.rowIndex ?? 0);
          if (idx >= 0 && idx < batches.length) targetId = batches[idx].id;
        }
        if (targetId) {
          await prisma.dtEmsBatch.update({
            where: { id: targetId },
            data: {
              emsCode: String(ems.emsCode ?? ""),
              items: JSON.stringify(ems.items ?? []),
            },
          });
        }
        break;
      }

      case "deleteEMSHistory": {
        let targetId: string | undefined = body.id;
        if (!targetId) {
          const batches = await prisma.dtEmsBatch.findMany({ orderBy: { createdAt: "desc" } });
          const idx = Number(body.rowIndex ?? 0);
          if (idx >= 0 && idx < batches.length) targetId = batches[idx].id;
        }
        if (targetId) {
          await prisma.dtEmsBatch.delete({ where: { id: targetId } });
        }
        break;
      }

      case "addProduct": {
        const p = body.product ?? body;
        await prisma.dtCatalog.create({
          data: {
            maSP: String(p.ma ?? p.maSP ?? ""),
            tenSP: String(p.ten ?? p.tenSP ?? ""),
            giaBan: Number(p.gia ?? p.giaBan ?? 0),
            giaMua: p.giaMua != null ? Number(p.giaMua) : p.giaNhap != null ? Number(p.giaNhap) : null,
            link: p.link ?? null,
            image: p.image ?? null,
          },
        });
        break;
      }

      case "updateProduct": {
        const p = body.product ?? body;
        const maSP = String(p.ma ?? p.maSP ?? "");
        const updateData: Record<string, unknown> = {};
        if (p.ten !== undefined || p.tenSP !== undefined) updateData.tenSP = String(p.ten ?? p.tenSP);
        if (p.gia !== undefined || p.giaBan !== undefined) updateData.giaBan = Number(p.gia ?? p.giaBan);
        if (p.giaMua !== undefined || p.giaNhap !== undefined) updateData.giaMua = p.giaMua != null ? Number(p.giaMua) : p.giaNhap != null ? Number(p.giaNhap) : null;
        if (p.link !== undefined) updateData.link = p.link;
        if (p.image !== undefined) updateData.image = p.image;
        await prisma.dtCatalog.update({ where: { maSP }, data: updateData });
        break;
      }

      case "uploadImage":
      case "aiChat":
      case "parseOrderAI": {
        return NextResponse.json({ success: false, error: `Action "${action}" requires Google Apps Script (not available in local mode)` }, { status: 501 });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Return full refreshed data after every mutation
    const data = await getFullData();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
