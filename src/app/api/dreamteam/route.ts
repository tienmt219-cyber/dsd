import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── helpers ──────────────────────────────────────────────────

function norm(v: unknown): string {
  return String(v ?? "").replace(/\.0$/, "").trim().toUpperCase();
}

function normName(s: unknown): string {
  return String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

function normalizeFb(raw: string): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  const idMatch = s.match(/profile\.php\?.*?id=(\d+)/i);
  if (idMatch) return "id:" + idMatch[1];
  const m = s.match(/^https?:\/\/[^/]+\/(.+?)(?:[?#]|$)/i);
  if (m) {
    const path = m[1].replace(/\/+$/, "");
    const parts = path.split("/").filter((x) => x.length);
    if (!parts.length) return "";
    return parts[parts.length - 1].toLowerCase();
  }
  return s.toLowerCase();
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
  const now = new Date();
  const offset = 9 * 60;
  const jst = new Date(now.getTime() + (offset + now.getTimezoneOffset()) * 60000);
  return `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, "0")}-${String(jst.getDate()).padStart(2, "0")}`;
}

function buildAddressMap(
  addresses: Array<{
    name: string;
    fb: string;
    postal: string;
    pref: string;
    city: string;
    street: string;
    phone: string;
    linkFb?: string;
  }>
) {
  const map: Record<string, { postal: string; pref: string; city: string; street: string; phone: string; fb: string }> = {};
  for (const a of addresses) {
    const nfb = normalizeFb(a.fb || a.linkFb || "");
    const fbRaw = a.fb || a.linkFb || "";
    const data = { postal: a.postal, pref: a.pref, city: a.city, street: a.street, phone: a.phone, fb: fbRaw };
    const name = normName(a.name);
    if (nfb) {
      map[`fb:${nfb}`] = data;
      map[`${name}|${nfb}`] = data;
    }
    map[name] = data;
  }
  return map;
}

// ── surplus helpers ──────────────────────────────────────────

async function findSurplus(maSP: string, size: string, color: string) {
  const all = await prisma.dtSurplus.findMany();
  return all.find((s) => norm(s.ma) === maSP && norm(s.sz) === size && norm(s.cl) === color && s.sl > 0) ?? null;
}

async function useSurplus(maSP: string, size: string, color: string, qty: number): Promise<string | null> {
  const found = await findSurplus(maSP, size, color);
  if (!found || found.sl <= 0 || found.sl < qty) return null;
  const newSl = found.sl - qty;
  if (newSl <= 0) {
    await prisma.dtSurplus.delete({ where: { id: found.id } });
  } else {
    await prisma.dtSurplus.update({ where: { id: found.id }, data: { sl: newSl } });
  }
  return found.trangThai || "Về kho";
}

async function addOrUpdateSurplus(maSP: string, size: string, color: string, qty: number, tt: string) {
  const found = await findSurplus(maSP, size, color);
  const today = todayStr();
  if (found) {
    await prisma.dtSurplus.update({
      where: { id: found.id },
      data: { sl: found.sl + qty, trangThai: tt, ngayTao: today },
    });
  } else {
    await prisma.dtSurplus.create({
      data: { ma: maSP, ten: "", sz: size, cl: color, sl: qty, trangThai: tt, ngayTao: today },
    });
  }
}

async function updateSurplusTT(maSP: string, size: string, color: string, newTT: string) {
  const found = await findSurplus(maSP, size, color);
  if (found && found.sl > 0) {
    await prisma.dtSurplus.update({ where: { id: found.id }, data: { trangThai: newTT } });
  }
}

// ── row index ────────────────────────────────────────────────

async function nextRowIndex(): Promise<number> {
  const last = await prisma.dtOrder.findFirst({ orderBy: { rowIndex: "desc" } });
  return last ? last.rowIndex + 1 : 2;
}

// ── verify row ───────────────────────────────────────────────

async function verifyRow(rowIndex: number, verify?: { tenKhach?: string; maSP?: string }): Promise<boolean> {
  if (!verify) return true;
  const order = await prisma.dtOrder.findUnique({ where: { rowIndex } });
  if (!order) return false;
  if (verify.tenKhach && String(order.tenKhach).trim() !== verify.tenKhach) return false;
  if (verify.maSP && norm(order.maSP) !== norm(verify.maSP)) return false;
  return true;
}

// ── getFullData ──────────────────────────────────────────────

async function getFullData() {
  const [orders, stock, catalog, addresses, surplus, emsBatches] = await Promise.all([
    prisma.dtOrder.findMany({ orderBy: { rowIndex: "asc" } }),
    prisma.dtStock.findMany({ orderBy: { id: "asc" } }),
    prisma.dtCatalog.findMany(),
    prisma.dtAddress.findMany(),
    prisma.dtSurplus.findMany(),
    prisma.dtEmsBatch.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return {
    success: true,
    _check: "v4.0.0",
    orders: orders
      .filter((o) => o.trangThai !== "Đã xoá" && o.trangThai !== "Lưu trữ")
      .map((o) => ({
        _rowIndex: o.rowIndex,
        "Tên khách": o.tenKhach,
        "Tên Sp": o.tenSp,
        "Mã SP": o.maSP,
        SIZE: o.size,
        COLOR: o.color,
        "Số lượng": o.soLuong,
        "Giá sp": o.giaSp,
        "Link fb": o.linkFb,
        "TRẠNG THÁI": o.trangThai,
        "NGÀY OD": o.ngayOd instanceof Date ? o.ngayOd.toISOString().slice(0, 10) : String(o.ngayOd ?? ""),
        _note: o.note ?? "",
      })),
    stock: stock.map((s) => ({
      _rowIndex: s.id,
      "Mã SP": s.ma,
      Size: s.size,
      Color: s.color,
      "Số lượng nhập": s.soLuong,
      "Ngày nhập": s.ngayNhap ?? "",
    })),
    catalog: catalog.map((c) => ({
      _rowIndex: c.id,
      "Mã SP": c.maSP,
      "Tên SP": c.tenSP,
      "Giá bán": c.giaBan,
      "Giá nhập": c.giaMua ?? 0,
      "Lợi nhuận/SP": c.loiNhuan ?? 0,
      "Margin%": c.margin ?? 0,
      Size: c.sizes ?? "",
      Màu: c.colors ?? "",
      "Đã bán": c.daBan ?? 0,
      Loại: c.loai ?? "",
      Ảnh: c.image ?? "",
    })),
    addresses: buildAddressMap(addresses as Array<{ name: string; fb: string; postal: string; pref: string; city: string; street: string; phone: string; linkFb?: string }>),
    surplus: surplus.map((s) => ({
      _rowIndex: s.id,
      "Mã SP": s.ma,
      Size: s.sz,
      Color: s.cl,
      "SL dư": s.sl,
      "Trạng thái": s.trangThai ?? "",
      "Ngày tạo": s.ngayTao ?? "",
    })),
    emsHistory: emsBatches.map((b) => {
      let parsedItems: unknown = "";
      try {
        parsedItems = typeof b.items === "string" ? JSON.stringify(JSON.parse(b.items)) : JSON.stringify(b.items);
      } catch {
        parsedItems = b.items;
      }
      return {
        _rowIndex: b.id,
        emsCode: b.emsCode,
        date: b.createdAt instanceof Date ? b.createdAt.toISOString().slice(0, 16).replace("T", " ") : String(b.createdAt ?? ""),
        skuCount: b.skuCount ?? 0,
        totalQty: b.totalQty ?? 0,
        detail: b.chiTiet ?? "",
        items: parsedItems,
        status: b.status ?? "Đã nhập kho",
        lastCheck: b.lastCheck ?? "",
        trackRaw: b.trackRaw ?? "",
      };
    }),
  };
}

// ── GET ──────────────────────────────────────────────────────

export async function GET() {
  try {
    const data = await getFullData();
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? "Unknown error" });
  }
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json") || ct.includes("text/plain")) {
      body = await request.json();
    } else {
      const text = await request.text();
      body = JSON.parse(text);
    }
    const { action } = body;
    let result: Record<string, unknown> = { success: true };

    switch (action) {
      // ══════ addOrder + surplus auto-match ══════
      case "addOrder": {
        const o = (body.order ?? body) as Record<string, unknown>;
        const maSP = norm(o.maSP);
        const size = norm(o.size);
        const color = norm(o.color);
        const qty = Number(o.soLuong) || 1;
        let status = "CHƯA ĐẶT";
        let autoNote: string | null = null;

        const surplusTT = await useSurplus(maSP, size, color, qty);
        if (surplusTT) {
          status = surplusTT;
          autoNote = "📦DƯ";
        }

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
                soLuong: qty,
                giaSp: Number(o.giaSp) || 0,
                linkFb: String(o.linkFb ?? ""),
                trangThai: status,
                ngayOd: o.ngayOd ? safeDate(o.ngayOd) : new Date(),
                note: autoNote,
              },
            });
            result = { success: true, row: ri, autoStatus: surplusTT ?? null };
            break;
          } catch (err: unknown) {
            if (attempt === 2 || !(err instanceof Error) || !err.message.includes("Unique")) throw err;
          }
        }
        break;
      }

      // ══════ addBatchOrders ══════
      case "addBatchOrders": {
        const orders = (body.orders ?? []) as Array<Record<string, unknown>>;
        let autoCount = 0;
        for (const o of orders) {
          const maSP = norm(o.maSP);
          const size = norm(o.size);
          const color = norm(o.color);
          const qty = Number(o.soLuong) || 1;
          let status = "CHƯA ĐẶT";
          let autoNote: string | null = null;

          const surplusTT = await useSurplus(maSP, size, color, qty);
          if (surplusTT) {
            status = surplusTT;
            autoNote = "📦DƯ";
            autoCount++;
          }

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
                  soLuong: qty,
                  giaSp: Number(o.giaSp) || 0,
                  linkFb: String(o.linkFb ?? ""),
                  trangThai: status,
                  ngayOd: o.ngayOd ? safeDate(o.ngayOd) : new Date(),
                  note: autoNote,
                },
              });
              break;
            } catch (err: unknown) {
              if (attempt === 2 || !(err instanceof Error) || !err.message.includes("Unique")) throw err;
            }
          }
        }
        result = { success: true, added: orders.length, autoCount };
        break;
      }

      // ══════ editOrder + verify ══════
      case "editOrder": {
        const ri = Number(body.rowIndex);
        if (!(await verifyRow(ri, body.verify as { tenKhach?: string; maSP?: string } | undefined))) {
          return json({ error: "Data thay đổi — refresh.", needReload: true });
        }
        const f = (body.fields ?? body) as Record<string, unknown>;
        const updateData: Record<string, unknown> = {};
        if (f.tenSp !== undefined) updateData.tenSp = f.tenSp;
        if (f.maSP !== undefined) updateData.maSP = f.maSP;
        if (f.size !== undefined) updateData.size = f.size;
        if (f.color !== undefined) updateData.color = f.color;
        if (f.soLuong !== undefined) updateData.soLuong = Number(f.soLuong);
        if (f.giaSp !== undefined) updateData.giaSp = Number(f.giaSp);
        if (f.linkFb !== undefined) updateData.linkFb = f.linkFb;
        if (f.note !== undefined) updateData.note = f.note;
        if (f.ngayOd !== undefined) updateData.ngayOd = safeDate(f.ngayOd);
        await prisma.dtOrder.update({ where: { rowIndex: ri }, data: updateData });
        result = { success: true, updated: Object.keys(updateData) };
        break;
      }

      // ══════ updateStatus + auto SENT note ══════
      case "updateStatus": {
        const ri = Number(body.rowIndex);
        if (!(await verifyRow(ri, body.verify as { tenKhach?: string; maSP?: string } | undefined))) {
          return json({ error: "Data thay đổi — refresh.", needReload: true });
        }
        const newStatus = String(body.newStatus ?? body.status ?? "");
        const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
        if (!order) return json({ error: "Not found" });

        const updateData: Record<string, unknown> = { trangThai: newStatus };
        if (newStatus === "Đã gửi") {
          const note = order.note ?? "";
          if (!note.includes("📮SENT")) {
            updateData.note = (note ? note + " " : "") + "📮SENT " + todayStr();
          }
        }
        await prisma.dtOrder.update({ where: { rowIndex: ri }, data: updateData });
        result = { success: true };
        break;
      }

      // ══════ bulkUpdateStatus + tracking + surplus ══════
      case "bulkUpdateStatus": {
        const items = (body.items ?? []) as Array<Record<string, unknown>>;
        const tracking = String(body.tracking ?? "");
        const today = todayStr();
        let ok = 0,
          skip = 0,
          returned = 0;

        for (const it of items) {
          const ri = Number(it.rowIndex);
          if (!(await verifyRow(ri, { tenKhach: it.tenKhach as string, maSP: it.maSP as string }))) {
            skip++;
            continue;
          }
          const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
          if (!order) {
            skip++;
            continue;
          }

          const newStatus = String(it.newStatus ?? "");

          if (newStatus === "Đã xoá") {
            const oldTT = order.trangThai;
            const qty = order.soLuong;
            if (qty > 0 && ["Về kho", "Chờ hàng", "Đang ship"].includes(oldTT)) {
              await addOrUpdateSurplus(norm(order.maSP), norm(order.size), norm(order.color), qty, oldTT === "Về kho" ? "Về kho" : "Chờ hàng");
              returned += qty;
            }
          }

          let note = order.note ?? "";
          if (tracking && !note.includes("📦EMS")) note = (note ? note + " " : "") + "📦EMS " + tracking;
          if (newStatus === "Đã gửi" && !note.includes("📮SENT")) note = (note ? note + " " : "") + "📮SENT " + today;

          await prisma.dtOrder.update({ where: { rowIndex: ri }, data: { trangThai: newStatus, note: note || null } });
          ok++;

          if (newStatus === "Đang ship" || newStatus === "Chờ hàng") {
            await updateSurplusTT(norm(order.maSP), norm(order.size), norm(order.color), newStatus);
          }
        }
        result = { success: true, updated: ok, skipped: skip, returned, tracking, needReload: skip > 0 };
        break;
      }

      // ══════ softDelete + trả surplus ══════
      case "softDelete":
      case "deleteOrder": {
        const ri = Number(body.rowIndex);
        if (!(await verifyRow(ri, body.verify as { tenKhach?: string; maSP?: string } | undefined))) {
          return json({ error: "Data thay đổi — refresh.", needReload: true });
        }
        const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
        if (!order) return json({ error: "Not found" });

        const oldStatus = order.trangThai;
        const maSP = norm(order.maSP),
          size = norm(order.size),
          color = norm(order.color);
        const qty = order.soLuong;

        await prisma.dtOrder.update({ where: { rowIndex: ri }, data: { trangThai: "Đã xoá" } });

        let returnedQty = 0;
        if (qty > 0 && maSP) {
          if (oldStatus === "Về kho") {
            await addOrUpdateSurplus(maSP, size, color, qty, "Về kho");
            returnedQty = qty;
          } else if (oldStatus === "Chờ hàng" || oldStatus === "Đang ship") {
            await addOrUpdateSurplus(maSP, size, color, qty, "Chờ hàng");
            returnedQty = qty;
          }
        }
        result = { success: true, returned: returnedQty };
        break;
      }

      // ══════ shipItems + tracking ══════
      case "shipItems": {
        const items = (body.items ?? []) as Array<Record<string, unknown>>;
        const rows: number[] = items.length > 0 ? items.map((i) => Number(i.rowIndex)) : ((body.rowIndexes ?? []) as number[]).map(Number);
        const tracking = String(body.tracking ?? "");
        const today = todayStr();
        let ok = 0,
          skip = 0;

        for (const ri of rows) {
          const item = items.find((i) => Number(i.rowIndex) === ri);
          if (item && !(await verifyRow(ri, { tenKhach: item.tenKhach as string, maSP: item.maSP as string }))) {
            skip++;
            continue;
          }
          const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
          if (!order) {
            skip++;
            continue;
          }

          let note = tracking ? "📦 " + tracking : "";
          const existing = order.note ?? "";
          if (existing && !note.includes(existing)) note = existing + (note ? " " + note : "");
          if (!note.includes("📮SENT")) note = (note ? note + " " : "") + "📮SENT " + today;

          await prisma.dtOrder.update({ where: { rowIndex: ri }, data: { trangThai: "Đã gửi", note: note.trim() || null } });
          ok++;
        }
        result = { success: true, shipped: ok, skipped: skip, tracking, needReload: skip > 0 };
        break;
      }

      // ══════ markCK (toggle) ══════
      case "markCK": {
        const ri = Number(body.rowIndex);
        if (!(await verifyRow(ri, body.verify as { tenKhach?: string; maSP?: string } | undefined))) {
          return json({ error: "Data thay đổi — refresh.", needReload: true });
        }
        const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
        if (!order) return json({ error: "Not found" });

        let note = order.note ?? "";
        const today = todayStr();
        if (note.includes("💰CK")) {
          note = note.replace(/\s*💰CK\s*\d{4}-\d{2}-\d{2}/, "").trim();
        } else {
          note = (note ? note + " " : "") + "💰CK " + today;
        }
        await prisma.dtOrder.update({ where: { rowIndex: ri }, data: { note: note || null } });
        result = { success: true, ck: note.includes("💰CK") };
        break;
      }

      // ══════ setCK (set only, no toggle) ══════
      case "setCK": {
        const ri = Number(body.rowIndex);
        if (!(await verifyRow(ri, body.verify as { tenKhach?: string; maSP?: string } | undefined))) {
          return json({ error: "Data thay đổi — refresh.", needReload: true });
        }
        const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
        if (!order) return json({ error: "Not found" });

        const note = order.note ?? "";
        if (note.includes("💰CK")) {
          result = { success: true };
        } else {
          const newNote = (note ? note + " " : "") + "💰CK " + todayStr();
          await prisma.dtOrder.update({ where: { rowIndex: ri }, data: { note: newNote } });
          result = { success: true };
        }
        break;
      }

      // ══════ batchMarkCK ══════
      case "batchMarkCK": {
        const items = (body.items ?? []) as Array<Record<string, unknown>>;
        const rows: number[] = items.length > 0 ? items.map((i) => Number(i.rowIndex)) : ((body.rowIndexes ?? []) as number[]).map(Number);
        const stamp = `💰CK ${todayStr()}`;
        let ok = 0;

        for (const ri of rows) {
          const item = items.find((i) => Number(i.rowIndex) === ri);
          if (item && !(await verifyRow(ri, { tenKhach: item.tenKhach as string, maSP: item.maSP as string }))) continue;
          const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
          if (!order) continue;
          const existing = order.note ?? "";
          if (existing.includes("💰CK")) continue;
          const newNote = existing ? `${existing} ${stamp}` : stamp;
          await prisma.dtOrder.update({ where: { rowIndex: ri }, data: { note: newNote } });
          ok++;
        }
        result = { success: true, marked: ok };
        break;
      }

      // ══════ batchUnmarkCK ══════
      case "batchUnmarkCK": {
        const items = (body.items ?? []) as Array<Record<string, unknown>>;
        const rows: number[] = items.length > 0 ? items.map((i) => Number(i.rowIndex)) : ((body.rowIndexes ?? []) as number[]).map(Number);
        let ok = 0;

        for (const ri of rows) {
          const item = items.find((i) => Number(i.rowIndex) === ri);
          if (item && !(await verifyRow(ri, { tenKhach: item.tenKhach as string, maSP: item.maSP as string }))) continue;
          const order = await prisma.dtOrder.findUnique({ where: { rowIndex: ri } });
          if (!order) continue;
          const existing = order.note ?? "";
          if (!existing.includes("💰CK")) continue;
          const cleaned = existing.replace(/\s*💰CK\s*\d{4}-\d{2}-\d{2}/g, "").trim();
          await prisma.dtOrder.update({ where: { rowIndex: ri }, data: { note: cleaned || null } });
          ok++;
        }
        result = { success: true, unmarked: ok };
        break;
      }

      // ══════ addStock + auto match orders ══════
      case "addStock": {
        const s = (body.item ?? body) as Record<string, unknown>;
        const maSP = norm(s.maSP ?? s.ma);
        const size = norm(s.size);
        const color = norm(s.color);
        const qty = Number(s.soLuong) || 1;
        const today = todayStr();

        await prisma.dtStock.create({
          data: {
            ma: maSP,
            ten: String(s.ten ?? ""),
            size,
            color,
            soLuong: qty,
            ngayNhap: today,
          },
        });

        const allOrders = await prisma.dtOrder.findMany({
          where: { trangThai: { in: ["Chờ hàng", "Đang ship"] } },
          orderBy: { ngayOd: "asc" },
        });

        const matches = allOrders.filter(
          (o) => norm(o.maSP) === maSP && norm(o.size) === size && norm(o.color) === color
        );

        let remaining = qty;
        const updated: string[] = [];
        for (const match of matches) {
          if (remaining <= 0) break;
          await prisma.dtOrder.update({ where: { rowIndex: match.rowIndex }, data: { trangThai: "Về kho" } });
          updated.push(match.tenKhach);
          remaining -= match.soLuong;
        }

        if (remaining > 0) await addOrUpdateSurplus(maSP, size, color, remaining, "Về kho");
        await updateSurplusTT(maSP, size, color, "Về kho");

        result = { success: true, stocked: qty, matched: updated.length, customers: updated, remaining: Math.max(remaining, 0) };
        break;
      }

      // ══════ addProduct ══════
      case "addProduct": {
        const p = (body.product ?? body) as Record<string, unknown>;
        const maSP = norm(p.maSP ?? p.ma);
        if (!maSP) return json({ error: "Thiếu Mã SP" });

        const existing = await prisma.dtCatalog.findUnique({ where: { maSP } });
        if (existing) return json({ error: `Mã ${maSP} đã có` });

        const giaBan = Number(p.giaBan ?? p.gia) || 0;
        const giaNhap = Number(p.giaNhap ?? p.giaMua) || 0;

        await prisma.dtCatalog.create({
          data: {
            maSP,
            tenSP: String(p.tenSP ?? p.ten ?? ""),
            giaBan,
            giaMua: giaNhap,
            loiNhuan: giaBan - giaNhap,
            margin: giaBan > 0 && giaNhap > 0 ? (giaBan - giaNhap) / giaBan : 0,
            sizes: String(p.size ?? p.sizes ?? ""),
            colors: String(p.mau ?? p.colors ?? ""),
            daBan: 0,
            loai: String(p.loai ?? ""),
            image: String(p.image ?? p.link ?? ""),
          },
        });
        result = { success: true };
        break;
      }

      // ══════ updateProduct ══════
      case "updateProduct": {
        const p = (body.product ?? body) as Record<string, unknown>;
        const ri = body.rowIndex as string;
        const maSP = String(p.maSP ?? p.ma ?? "");

        const giaBan = Number(p.giaBan ?? p.gia) || 0;
        const giaNhap = Number(p.giaNhap ?? p.giaMua) || 0;

        const updateData: Record<string, unknown> = {
          maSP,
          tenSP: String(p.tenSP ?? p.ten ?? ""),
          giaBan,
          giaMua: giaNhap,
          loiNhuan: giaBan - giaNhap,
          margin: giaBan > 0 && giaNhap > 0 ? (giaBan - giaNhap) / giaBan : 0,
          sizes: String(p.size ?? p.sizes ?? ""),
          colors: String(p.mau ?? p.colors ?? ""),
          daBan: Number(p.daBan) || 0,
          loai: String(p.loai ?? ""),
        };
        if (p.image !== undefined) updateData.image = p.image;

        if (ri) {
          await prisma.dtCatalog.update({ where: { id: String(ri) }, data: updateData });
        } else if (maSP) {
          await prisma.dtCatalog.update({ where: { maSP }, data: updateData });
        }
        result = { success: true };
        break;
      }

      // ══════ saveAddress ══════
      case "saveAddress": {
        const addr = (body.address ?? body) as Record<string, string>;
        const name = normName(body.name);
        const fb = String(body.fb ?? "").trim();
        if (!name) return json({ error: "Tên khách rỗng" });

        const postal = addr.postal ?? "";
        const pref = addr.pref ?? "";
        const city = addr.city ?? "";
        const street = addr.street ?? "";
        const phone = addr.phone ?? "";

        const fbKey = normalizeFb(fb);
        const allAddrs = await prisma.dtAddress.findMany();

        let foundId: string | null = null;
        if (fbKey) {
          const byFb = allAddrs.find((a) => normalizeFb(a.fb) === fbKey);
          if (byFb) foundId = byFb.id;
        }
        if (!foundId) {
          const byName = allAddrs.find((a) => normName(a.name) === name && !a.fb);
          if (byName) foundId = byName.id;
        }

        if (foundId) {
          const upd: Record<string, string> = { name, postal, pref, city, street, phone };
          if (fb) upd.fb = fb;
          await prisma.dtAddress.update({ where: { id: foundId }, data: upd });
          result = { success: true, row: foundId };
        } else {
          const created = await prisma.dtAddress.create({
            data: { name, fb, postal, pref, city, street, phone },
          });
          result = { success: true, row: created.id, isNew: true };
        }
        break;
      }

      // ══════ addSurplus ══════
      case "addSurplus": {
        const maSP = norm(body.maSP);
        const size = norm(body.size);
        const color = norm(body.color);
        const qty = Number(body.qty ?? body.soLuong) || 0;
        if (!maSP || qty <= 0) return json({ error: "Thiếu mã SP hoặc SL" });
        await addOrUpdateSurplus(maSP, size, color, qty, String(body.status ?? body.trangThai ?? "Chờ hàng"));
        result = { success: true };
        break;
      }

      // ══════ saveEMSHistory ══════
      case "saveEMSHistory":
      case "createEmsBatch": {
        const ems = (body.ems ?? body) as Record<string, unknown>;
        const emsItems = (ems.items ?? []) as Array<Record<string, unknown>>;
        const detail = emsItems.map((it) => `${it.sku ?? it.ma ?? ""} ${it.size ?? ""} ${it.color ?? ""} x${it.qty ?? it.soLuong ?? 0}`).join(", ");
        const skuCount = emsItems.length;
        const totalQty = emsItems.reduce((s, it) => s + (Number(it.qty ?? it.soLuong) || 0), 0);

        await prisma.dtEmsBatch.create({
          data: {
            emsCode: String(ems.emsCode ?? ""),
            items: JSON.stringify(emsItems),
            skuCount,
            totalQty,
            chiTiet: detail,
            status: "Đã nhập kho",
          },
        });
        result = { success: true };
        break;
      }

      // ══════ editEMSHistory ══════
      case "editEMSHistory": {
        const ri = body.rowIndex;
        const ems = (body.ems ?? body) as Record<string, unknown>;
        const emsCode = String(ems.emsCode ?? "").trim();
        const emsItems = (ems.items ?? []) as Array<Record<string, unknown>>;
        if (!emsCode) return json({ error: "Thiếu mã EMS" });

        let targetId: string | undefined = (body.id ?? ems.id) as string | undefined;
        if (!targetId && ri !== undefined) {
          targetId = String(ri);
        }
        if (!targetId) return json({ error: "Thiếu ID" });

        const detail = emsItems.map((it) => `${it.sku ?? it.ma ?? ""} ${it.size ?? ""} ${it.color ?? ""} x${it.qty ?? 0}`).join(", ");
        const skuCount = emsItems.length;
        const totalQty = emsItems.reduce((s, it) => s + (Number(it.qty) || 0), 0);

        await prisma.dtEmsBatch.update({
          where: { id: targetId },
          data: { emsCode, items: JSON.stringify(emsItems), skuCount, totalQty, chiTiet: detail },
        });
        result = { success: true, row: targetId };
        break;
      }

      // ══════ deleteEMSHistory ══════
      case "deleteEMSHistory": {
        let targetId: string | undefined = body.id as string | undefined;
        if (!targetId && body.rowIndex !== undefined) {
          targetId = String(body.rowIndex);
        }
        if (!targetId) return json({ error: "Thiếu ID" });
        await prisma.dtEmsBatch.delete({ where: { id: targetId } });
        result = { success: true };
        break;
      }

      // ══════ shipEMSWithStock (compound — most complex) ══════
      case "shipEMSWithStock": {
        const ems = (body.ems ?? body) as Record<string, unknown>;
        const emsCode = String(ems.emsCode ?? "").trim();
        const emsItems = (ems.items ?? []) as Array<Record<string, unknown>>;
        if (!emsCode) return json({ error: "Thiếu mã EMS" });
        if (!emsItems.length) return json({ error: "Kiện không có SKU" });

        const today = todayStr();
        const emsNote = "📦EMS " + emsCode;
        const allOrders = await prisma.dtOrder.findMany({ orderBy: { ngayOd: "asc" } });
        const stopStatuses = ["Về kho", "Đã gửi", "Đã xoá", "Lưu trữ"];
        const eligibleT1 = ["Chờ hàng", "Đang ship", "CHƯA ĐẶT"];
        const eligibleT2 = ["Chờ hàng"];

        const updatedRows = new Set<number>();
        let ordersUpdated = 0,
          reshipped = 0,
          newShipped = 0;
        const surplusList: string[] = [];
        const stockRows: Array<{ ma: string; size: string; color: string; qty: number }> = [];

        for (const it of emsItems) {
          const maSP = norm(it.sku ?? it.ma ?? it.maSP);
          const size = norm(it.size ?? it.sz);
          const color = norm(it.color ?? it.cl);
          const qty = Number(it.qty ?? it.soLuong) || 0;
          if (!maSP || qty <= 0) continue;

          const withNote: typeof allOrders = [];
          const withoutNote: typeof allOrders = [];

          for (const o of allOrders) {
            if (updatedRows.has(o.rowIndex)) continue;
            if (stopStatuses.includes(o.trangThai)) continue;
            if (norm(o.maSP) !== maSP || norm(o.size) !== size || norm(o.color) !== color) continue;

            const noteR = o.note ?? "";
            if (noteR.includes(emsNote) && eligibleT1.includes(o.trangThai)) {
              withNote.push(o);
            } else if (eligibleT2.includes(o.trangThai) && !noteR.includes("📦EMS")) {
              withoutNote.push(o);
            }
          }

          const matches = [...withNote, ...withoutNote];
          let remaining = qty;

          for (const match of matches) {
            if (remaining <= 0) break;
            if (match.soLuong <= remaining) {
              const isReship = (match.note ?? "").includes(emsNote);
              let newNote = match.note ?? "";
              if (!isReship) {
                newNote = (newNote ? newNote + " " : "") + emsNote;
                newShipped++;
              } else {
                reshipped++;
              }
              await prisma.dtOrder.update({
                where: { rowIndex: match.rowIndex },
                data: { trangThai: "Về kho", note: newNote },
              });
              updatedRows.add(match.rowIndex);
              remaining -= match.soLuong;
              ordersUpdated++;
            }
          }

          if (remaining > 0) {
            await addOrUpdateSurplus(maSP, size, color, remaining, "Về kho");
            surplusList.push(`${maSP} ${size} ${color} x${remaining}`);
          }
          await updateSurplusTT(maSP, size, color, "Về kho");
          stockRows.push({ ma: maSP, size, color, qty });
        }

        for (const sr of stockRows) {
          await prisma.dtStock.create({
            data: { ma: sr.ma, ten: "", size: sr.size, color: sr.color, soLuong: sr.qty, ngayNhap: today },
          });
        }

        const detail = emsItems.map((it) => `${it.sku ?? it.ma ?? ""} ${it.size ?? ""} ${it.color ?? ""} x${it.qty ?? 0}`).join(", ");
        await prisma.dtEmsBatch.create({
          data: {
            emsCode,
            items: JSON.stringify(emsItems),
            skuCount: emsItems.length,
            totalQty: emsItems.reduce((s, it) => s + (Number(it.qty) || 0), 0),
            chiTiet: detail,
            status: "Đã nhập kho",
          },
        });

        result = { success: true, emsCode, ordersUpdated, reshipped, newShipped, stockAdded: stockRows.length, surplusList };
        break;
      }

      // ══════ lookupOrders ══════
      case "lookupOrders": {
        const name = String(body.name ?? "").trim().toLowerCase();
        const phone = String(body.phone ?? "").trim().replace(/[-\s]/g, "");
        if (!name) {
          result = { success: true, orders: [] };
          break;
        }
        const allOrders = await prisma.dtOrder.findMany({ orderBy: { ngayOd: "desc" } });
        const results: Array<Record<string, unknown>> = [];
        for (const o of allOrders) {
          if (o.tenKhach.trim().toLowerCase() !== name) continue;
          if (o.trangThai === "Đã xoá" || o.trangThai === "Lưu trữ") continue;
          if (phone && phone.length >= 4) {
            const fbNorm = o.linkFb.replace(/[-\s]/g, "");
            if (fbNorm.startsWith("http") && !fbNorm.includes(phone)) continue;
            if (fbNorm.startsWith("📱") && !fbNorm.includes(phone)) continue;
          }
          results.push({
            tenSp: o.tenSp,
            maSP: o.maSP,
            size: o.size,
            color: o.color,
            soLuong: o.soLuong,
            giaSp: o.giaSp,
            ngayOD: o.ngayOd instanceof Date ? o.ngayOd.toISOString().slice(0, 10) : String(o.ngayOd ?? ""),
            trangThai: o.trangThai,
          });
        }
        result = { success: true, orders: results };
        break;
      }

      // ══════ editCatalog (kept for frontend compat) ══════
      case "editCatalog": {
        const updateData: Record<string, unknown> = {};
        if (body.tenSP !== undefined) updateData.tenSP = body.tenSP;
        if (body.giaBan !== undefined) {
          updateData.giaBan = Number(body.giaBan);
          const giaNhap = body.giaMua != null ? Number(body.giaMua) : undefined;
          if (giaNhap !== undefined) {
            updateData.giaMua = giaNhap;
            updateData.loiNhuan = Number(body.giaBan) - giaNhap;
            updateData.margin = Number(body.giaBan) > 0 ? (Number(body.giaBan) - giaNhap) / Number(body.giaBan) : 0;
          }
        }
        if (body.giaMua !== undefined) updateData.giaMua = Number(body.giaMua);
        if (body.link !== undefined) updateData.image = body.link;
        if (body.image !== undefined) updateData.image = body.image;
        await prisma.dtCatalog.update({ where: { maSP: body.maSP as string }, data: updateData });
        result = { success: true };
        break;
      }

      case "deleteCatalog": {
        await prisma.dtCatalog.delete({ where: { maSP: body.maSP as string } });
        result = { success: true };
        break;
      }

      // ══════ Stock CRUD ══════
      case "editStock": {
        const updateData: Record<string, unknown> = {};
        if (body.ma !== undefined) updateData.ma = body.ma;
        if (body.ten !== undefined) updateData.ten = body.ten;
        if (body.size !== undefined) updateData.size = body.size;
        if (body.color !== undefined) updateData.color = body.color;
        if (body.soLuong !== undefined) updateData.soLuong = Number(body.soLuong);
        if (body.note !== undefined) updateData.note = body.note;
        await prisma.dtStock.update({ where: { id: body.id as string }, data: updateData });
        result = { success: true };
        break;
      }

      case "deleteStock": {
        await prisma.dtStock.delete({ where: { id: body.id as string } });
        result = { success: true };
        break;
      }

      // ══════ Surplus edit ══════
      case "editSurplus": {
        const updateData: Record<string, unknown> = {};
        if (body.ma !== undefined) updateData.ma = String(body.ma);
        if (body.sz !== undefined) updateData.sz = String(body.sz);
        if (body.cl !== undefined) updateData.cl = String(body.cl);
        if (body.sl !== undefined) updateData.sl = Number(body.sl);
        if (body.note !== undefined) updateData.trangThai = body.note;
        if (body.trangThai !== undefined) updateData.trangThai = body.trangThai;
        await prisma.dtSurplus.update({ where: { id: body.id as string }, data: updateData });
        result = { success: true };
        break;
      }

      // ══════ AI functions — proxy to external APIs ══════
      case "parseOrderAI": {
        const aiResult = await callParseOrderAI(body);
        return json(aiResult);
      }

      case "aiChat": {
        const aiResult = await callAiChat(body);
        return json(aiResult);
      }

      // ══════ uploadImage — local file save ══════
      case "uploadImage": {
        const base64 = String(body.base64 ?? "");
        const fileName = String(body.fileName ?? "product.jpg");
        const maSP = String(body.maSP ?? "");

        if (!base64) return json({ error: "No image data" });

        const fs = await import("fs");
        const path = await import("path");
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, `${Date.now()}-${fileName}`);
        fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
        const url = `/uploads/${path.basename(filePath)}`;

        if (maSP) {
          const cat = await prisma.dtCatalog.findUnique({ where: { maSP: norm(maSP) } });
          if (cat) {
            await prisma.dtCatalog.update({ where: { maSP: norm(maSP) }, data: { image: url } });
          }
        }
        result = { success: true, url };
        break;
      }

      default:
        return json({ error: `Unknown action: ${action}` });
    }

    const heavyActions = [
      "addStock", "softDelete", "deleteOrder", "bulkUpdateStatus", "shipItems",
      "addSurplus", "shipEMSWithStock", "editEMSHistory", "deleteEMSHistory",
      "markCK", "batchMarkCK", "batchUnmarkCK",
    ];
    if (result.success && heavyActions.includes(action as string)) {
      const data = await getFullData();
      return json({ ...result, data });
    }

    const data = await getFullData();
    return json({ ...result, data });
  } catch (e: unknown) {
    return json({ error: (e as Error).message ?? "Unknown error" });
  }
}

function json(obj: Record<string, unknown>) {
  return NextResponse.json(obj);
}

// ══════ AI FUNCTIONS ══════

const GEMINI_KEY = process.env.GEMINI_KEY ?? "AIzaSyDoabiBYK6T08k33o4fSvxS4DXlsyHOMG0";
const CLAUDE_KEY = process.env.CLAUDE_KEY ?? "";

async function callParseOrderAI(body: Record<string, unknown>) {
  const input = body.input;
  const inputType = String(body.inputType ?? "text");
  const contextSP = String(body.contextSP ?? "");
  const aiModel = String(body.aiModel ?? "gemini-flash");

  const validSPs = await getValidSPList();
  const systemPrompt = buildParsePrompt(validSPs, contextSP);
  const parts: Array<Record<string, unknown>> = [];

  if (inputType === "image") {
    const images = Array.isArray(input) ? input : [input];
    for (const imgData of images) {
      const s = String(imgData);
      const mimeType = s.startsWith("data:image/png") ? "image/png" : s.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
      parts.push({ inlineData: { mimeType, data: s.replace(/^data:image\/[a-z]+;base64,/, "") } });
    }
    parts.push({ text: contextSP ? `Screenshot. Mã SP bài đăng: ${contextSP}. Parse tất cả.` : "Screenshot. Parse tất cả." });
  } else {
    parts.push({ text: contextSP ? `Mã SP bài đăng: ${contextSP}\n\nTin nhắn:\n${input}` : `Tin nhắn:\n${input}` });
  }

  const result = await callGemini(systemPrompt, parts, aiModel, true);
  if (result.error) return { success: false, error: result.error };

  try {
    let jsonStr = String(result.text).replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    jsonStr = jsonStr.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    const parsed = JSON.parse(jsonStr);
    return { success: true, orders: parsed.orders ?? [], note: parsed.note ?? "" };
  } catch (e) {
    return { success: false, error: "JSON parse error: " + (e as Error).message };
  }
}

async function callAiChat(body: Record<string, unknown>) {
  const message = String(body.message ?? "");
  const aiModel = String(body.aiModel ?? "gemini-flash");
  const images = (body.images ?? []) as string[];
  const history = (body.history ?? []) as Array<{ role: string; text: string }>;

  const summary = await getSheetsSummary();
  const SHOP_MAM_MEMORY = `BẠN LÀ TRỢ LÝ AI CỦA SHOP MAM\n\nTỔNG QUAN: Shop thời trang nữ pre-order Quảng Châu → Nhật Bản, bán cho người Việt tại Nhật. Chủ shop: Tien (1 người). 100% pre-order, không cọc.\nTHANH TOÁN: PayPay 09030991196 | GMO あおぞらネット銀行 法人営業部(101) 2573738 ド ) キン | Techcombank 8109030991196 TRINH THI PHUONG (không ghi nội dung CK)\n\nMÃ SP: AK=Áo khoác, AT=Áo thun, QJ=Quần jean, VD=Váy đầm, PK=Phụ kiện, TU=Túi + số\nFLOW ĐƠN: CHƯA ĐẶT → Chờ hàng → Đang ship → Về kho (auto khi Ship kiện EMS) → Đã gửi → Lưu trữ\nSHEETS: NHẬP ĐƠN | KHO HÀNG | CATALOG | KHÁCH HÀNG | HÀNG DƯ | LỊCH SỬ EMS\n\nNGUYÊN TẮC: Trả lời ngắn gọn, thực tế, tiếng Việt.`;
  const systemPrompt = SHOP_MAM_MEMORY + "\n\nDỮ LIỆU HIỆN TẠI:\n" + summary;

  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];
  const recentHistory = history.slice(-10);
  for (const h of recentHistory) {
    contents.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text ?? "" }] });
  }

  const currentParts: Array<Record<string, unknown>> = [];
  if (images.length > 0) {
    for (const img of images) {
      const mimeType = img.startsWith("data:image/png") ? "image/png" : "image/jpeg";
      currentParts.push({ inlineData: { mimeType, data: img.replace(/^data:image\/[a-z]+;base64,/, "") } });
    }
  }
  currentParts.push({ text: message });
  contents.push({ role: "user", parts: currentParts });

  const modelMap: Record<string, string> = { "gemini-flash": "gemini-2.5-flash", "gemini-pro": "gemini-2.5-pro" };
  const model = modelMap[aiModel] ?? "gemini-2.5-flash";

  const payload = {
    systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.3, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) return { success: false, error: `Gemini ${res.status}: ${data.error?.message ?? "Unknown"}` };

    let text = "";
    if (data.candidates?.[0]?.content?.parts) {
      for (const p of data.candidates[0].content.parts) {
        if (p.text && !p.thought) text = p.text;
      }
    }
    if (!text) return { success: false, error: "Gemini không trả kết quả" };
    return { success: true, reply: text };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

async function callGemini(systemPrompt: string, userParts: Array<Record<string, unknown>>, aiModel: string, isJSON: boolean) {
  const modelMap: Record<string, string> = { "gemini-flash": "gemini-2.5-flash", "gemini-pro": "gemini-2.5-pro" };
  const model = modelMap[aiModel] ?? "gemini-2.5-flash";
  const genConfig: Record<string, unknown> = { temperature: 0.1, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } };
  if (isJSON) genConfig.responseMimeType = "application/json";

  const payload = {
    systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: userParts }],
    generationConfig: genConfig,
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) return { error: `Gemini ${res.status}: ${data.error?.message ?? "Unknown"}` };

    let text = "";
    if (data.candidates?.[0]?.content?.parts) {
      for (const p of data.candidates[0].content.parts) {
        if (p.text && !p.thought) text = p.text;
      }
    }
    if (!text) return { error: "Gemini không trả kết quả" };
    return { text };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

async function getValidSPList(): Promise<string[]> {
  const catalog = await prisma.dtCatalog.findMany({ select: { maSP: true } });
  const orders = await prisma.dtOrder.findMany({ select: { maSP: true }, distinct: ["maSP"] });
  const spSet = new Set<string>();
  for (const c of catalog) {
    const sp = c.maSP.trim().toUpperCase();
    if (sp && sp !== "UNDEFINED" && sp !== "NULL") spSet.add(sp);
  }
  for (const o of orders) {
    const sp = o.maSP.trim().toUpperCase();
    if (sp && sp !== "UNDEFINED" && sp !== "NULL") spSet.add(sp);
  }
  return [...spSet].sort();
}

function buildParsePrompt(validSPs: string[], contextSP: string): string {
  const spList = validSPs.length > 0 ? "Mã SP hợp lệ: " + validSPs.join(", ") : "Chưa có danh sách SP.";
  return `Bạn là AI nhập đơn cho Shop MAM — shop thời trang pre-order Quảng Châu, bán cho người Việt tại Nhật.\n\nNHIỆM VỤ: Parse thông tin đặt hàng từ tin nhắn/screenshot, trả JSON.\n\nQUY TẮC:\n1. Trích: tên khách, mã SP, size, color, số lượng\n2. Không có mã SP + có contextSP → dùng contextSP\n3. Size: S, M, L, XL, 2XL, 3XL, hoặc số\n4. Color: chuẩn hoá tiếng Việt CÓ DẤU, viết HOA chữ đầu\n5. Thiếu SL → mặc định 1. 1 khách nhiều SP → nhiều dòng\n6. Bỏ comment không phải đặt hàng (hỏi giá, khen, emoji...)\n7. Không chắc → unclear: true\n8. Khách nói '2 chiếc' rồi '1 hồng 1 xanh' → 2 đơn riêng\n\n${spList}\n${contextSP ? "MÃ SP BÀI ĐĂNG: " + contextSP + "\n" : ""}\nTRẢ VỀ ĐÚNG FORMAT JSON:\n{"orders":[{"ten_khach":"","ma_sp":"","size":"","color":"","so_luong":1,"unclear":false,"ghi_chu":""}],"note":""}`;
}

async function getSheetsSummary(): Promise<string> {
  const orders = await prisma.dtOrder.findMany();
  const today = todayStr();

  const byS: Record<string, number> = { "CHƯA ĐẶT": 0, "Chờ hàng": 0, "Đang ship": 0, "Về kho": 0, "Đã gửi": 0 };
  let total = 0, todayCount = 0, todayRev = 0, totalRev = 0, noCK = 0;
  const custSet = new Set<string>();
  const spCount: Record<string, number> = {};

  for (const o of orders) {
    if (o.trangThai === "Đã xoá" || o.trangThai === "Lưu trữ") continue;
    total++;
    custSet.add(o.tenKhach);
    if (byS[o.trangThai] !== undefined) byS[o.trangThai]++;
    const price = o.giaSp * o.soLuong;
    totalRev += price;
    const dateStr = o.ngayOd instanceof Date ? o.ngayOd.toISOString().slice(0, 10) : String(o.ngayOd ?? "");
    if (dateStr === today) { todayCount++; todayRev += price; }
    const sp = norm(o.maSP);
    if (sp) spCount[sp] = (spCount[sp] || 0) + 1;
    if (o.trangThai === "Đã gửi" && !(o.note ?? "").includes("💰CK")) noCK++;
  }

  const topSP = Object.entries(spCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map((e) => `${e[0]}:${e[1]}`).join(", ");

  const surplus = await prisma.dtSurplus.findMany();
  let surplusInfo = "";
  const surplusItems = surplus.filter((s) => s.sl > 0).map((s) => `${s.ma} ${s.sz} ${s.cl} x${s.sl} [${s.trangThai}]`);
  if (surplusItems.length) surplusInfo = "\nHàng dư: " + surplusItems.join(", ");

  return [
    `Tổng: ${total} đơn, ${custSet.size} khách, DT ¥${totalRev.toLocaleString()}`,
    `Hôm nay: ${todayCount} đơn mới, ¥${todayRev.toLocaleString()}`,
    `TT: CHƯA ĐẶT ${byS["CHƯA ĐẶT"]}, Chờ hàng ${byS["Chờ hàng"]}, Đang ship ${byS["Đang ship"]}, Về kho ${byS["Về kho"]}, Đã gửi ${byS["Đã gửi"]}`,
    `Chưa CK: ${noCK} đơn`,
    `Top SP: ${topSP}`,
    surplusInfo,
  ].join("\n");
}
