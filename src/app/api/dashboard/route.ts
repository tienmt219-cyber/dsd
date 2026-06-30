import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Today's orders
    const todayOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: todayStart, lt: todayEnd },
        status: "completed",
      },
    });

    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const todayOrderCount = todayOrders.length;

    // Revenue by day for last 7 days
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const recentOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        status: "completed",
      },
      select: { total: true, createdAt: true },
    });

    const revenueByDay: Array<{ date: string; revenue: number; orders: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(todayStart);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const dateStr = date.toISOString().slice(0, 10);

      const dayOrders = recentOrders.filter((o) => {
        const d = new Date(o.createdAt);
        return d >= date && d < nextDate;
      });

      revenueByDay.push({
        date: dateStr,
        revenue: dayOrders.reduce((sum, o) => sum + o.total, 0),
        orders: dayOrders.length,
      });
    }

    // Top 5 selling products (by quantity in last 30 days)
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topItems = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          status: "completed",
          createdAt: { gte: thirtyDaysAgo },
        },
      },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    });

    const topProductIds = topItems.map((i) => i.productId);
    const topProductDetails = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, image: true },
    });

    const topProducts = topItems.map((item) => {
      const product = topProductDetails.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        name: product?.name || "",
        image: product?.image || null,
        totalQuantity: item._sum.quantity || 0,
        totalRevenue: item._sum.total || 0,
      };
    });

    // Low stock alerts (variants with stock < 5)
    const lowStockVariants = await prisma.productVariant.findMany({
      where: {
        stock: { lt: 5 },
        active: true,
        product: { active: true },
      },
      include: {
        product: { select: { id: true, name: true } },
      },
      orderBy: { stock: "asc" },
      take: 20,
    });

    return NextResponse.json({
      todayRevenue,
      todayOrderCount,
      topProducts,
      revenueByDay,
      lowStockAlerts: lowStockVariants.map((v) => ({
        variantId: v.id,
        productId: v.product.id,
        productName: v.product.name,
        size: v.size,
        color: v.color,
        sku: v.sku,
        stock: v.stock,
      })),
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
