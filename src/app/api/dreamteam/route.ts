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
    orders,
    stock,
    catalog,
    addresses: buildAddressMap(addresses),
    surplus,
    emsHistory: emsBatches.map((b) => ({
      id: b.id,
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
        const ri = await nextRowIndex();
        await prisma.dtOrder.create({
          data: {
            rowIndex: ri,
            tenKhach: body.tenKhach ?? "",
            tenSp: body.tenSp ?? "",
            maSP: body.maSP ?? "",
            size: body.size ?? "",
            color: body.color ?? "",
            soLuong: Number(body.soLuong) || 1,
            giaSp: Number(body.giaSp) || 0,
            linkFb: body.linkFb ?? "",
            trangThai: "CHƯA ĐẶT",
            ngayOd: body.ngayOd ? new Date(body.ngayOd) : new Date(),
          },
        });
        break;
      }

      case "addBatchOrders": {
        const orders: Array<Record<string, unknown>> = body.orders ?? [];
        let ri = await nextRowIndex();
        for (const o of orders) {
          await prisma.dtOrder.create({
            data: {
              rowIndex: ri++,
              tenKhach: (o.tenKhach as string) ?? "",
              tenSp: (o.tenSp as string) ?? "",
              maSP: (o.maSP as string) ?? "",
              size: (o.size as string) ?? "",
              color: (o.color as string) ?? "",
              soLuong: Number(o.soLuong) || 1,
              giaSp: Number(o.giaSp) || 0,
              linkFb: (o.linkFb as string) ?? "",
              trangThai: "CHƯA ĐẶT",
              ngayOd: o.ngayOd ? new Date(o.ngayOd as string) : new Date(),
            },
          });
        }
        break;
      }

      case "editOrder": {
        const { rowIndex, ...fields } = body;
        const updateData: Record<string, unknown> = {};
        if (fields.tenKhach !== undefined) updateData.tenKhach = fields.tenKhach;
        if (fields.tenSp !== undefined) updateData.tenSp = fields.tenSp;
        if (fields.maSP !== undefined) updateData.maSP = fields.maSP;
        if (fields.size !== undefined) updateData.size = fields.size;
        if (fields.color !== undefined) updateData.color = fields.color;
        if (fields.soLuong !== undefined) updateData.soLuong = Number(fields.soLuong);
        if (fields.giaSp !== undefined) updateData.giaSp = Number(fields.giaSp);
        if (fields.linkFb !== undefined) updateData.linkFb = fields.linkFb;
        if (fields.note !== undefined) updateData.note = fields.note;
        if (fields.ngayOd !== undefined) updateData.ngayOd = new Date(fields.ngayOd);
        // remove action from updateData
        delete updateData.action;
        await prisma.dtOrder.update({ where: { rowIndex: Number(rowIndex) }, data: updateData });
        break;
      }

      case "updateStatus": {
        await prisma.dtOrder.update({
          where: { rowIndex: Number(body.rowIndex) },
          data: { trangThai: body.status },
        });
        break;
      }

      case "deleteOrder": {
        await prisma.dtOrder.update({
          where: { rowIndex: Number(body.rowIndex) },
          data: { trangThai: "Đã xoá" },
        });
        break;
      }

      case "batchMarkCK": {
        const rows: number[] = (body.rowIndexes ?? []).map(Number);
        const stamp = `💰CK ${todayStr()}`;
        for (const ri of rows) {
          const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
          if (!order) continue;
          const existing = order.note ?? "";
          if (existing.includes("💰CK")) continue; // already marked
          const newNote = existing ? `${existing} ${stamp}` : stamp;
          await prisma.dtOrder.update({ where: { rowIndex: ri }, data: { note: newNote } });
        }
        break;
      }

      case "batchUnmarkCK": {
        const rows: number[] = (body.rowIndexes ?? []).map(Number);
        for (const ri of rows) {
          const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
          if (!order) continue;
          const cleaned = (order.note ?? "").replace(/\s*💰CK\s*\d{4}-\d{2}-\d{2}/g, "").trim();
          await prisma.dtOrder.update({ where: { rowIndex: ri }, data: { note: cleaned || null } });
        }
        break;
      }

      case "shipItems": {
        const rows: number[] = (body.rowIndexes ?? []).map(Number);
        const stamp = `📮SENT ${todayStr()}`;
        for (const ri of rows) {
          const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
          if (!order) continue;
          const existing = order.note ?? "";
          const newNote = existing ? `${existing} ${stamp}` : stamp;
          await prisma.dtOrder.update({
            where: { rowIndex: ri },
            data: { trangThai: "Đã gửi", note: newNote },
          });
        }
        break;
      }

      // ── Address ─────────────────────────────────────────
      case "saveAddress": {
        await prisma.dtAddress.upsert({
          where: { name_fb: { name: body.name, fb: body.fb } },
          create: {
            name: body.name,
            fb: body.fb,
            postal: body.postal ?? "",
            pref: body.pref ?? "",
            city: body.city ?? "",
            street: body.street ?? "",
            phone: body.phone ?? "",
          },
          update: {
            postal: body.postal ?? "",
            pref: body.pref ?? "",
            city: body.city ?? "",
            street: body.street ?? "",
            phone: body.phone ?? "",
          },
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
        await prisma.dtStock.create({
          data: {
            ma: body.ma ?? "",
            ten: body.ten ?? "",
            size: body.size ?? "",
            color: body.color ?? "",
            soLuong: Number(body.soLuong) || 0,
            note: body.note ?? null,
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
