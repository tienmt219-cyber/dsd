import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateOrderNumber } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || "";
    const customerId = searchParams.get("customerId") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (from || to) {
      where.createdAt = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to + "T23:59:59.999Z") }),
      };
    }

    if (search) {
      where.orderNumber = { contains: search };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: true,
          user: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      customerId,
      items,
      discount = 0,
      discountType = "amount",
      paymentMethod = "cash",
      paid,
      note,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Order must have at least one item" }, { status: 400 });
    }

    const order = await prisma.$transaction(async (tx) => {
      // Calculate subtotal
      let subtotal = 0;
      const orderItems: Array<{
        productId: string;
        variantId: string | null;
        name: string;
        variantInfo: string | null;
        quantity: number;
        price: number;
        discount: number;
        total: number;
      }> = [];

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        let price = product.sellPrice;
        let variantInfo: string | null = null;

        if (item.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
          });
          if (!variant) {
            throw new Error(`Variant ${item.variantId} not found`);
          }
          if (variant.stock < item.quantity) {
            throw new Error(`Insufficient stock for variant ${variant.sku}`);
          }
          price = variant.sellPrice;
          variantInfo = `${variant.size} / ${variant.color}`;

          // Decrease variant stock
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          });

          // Record stock movement
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId,
              type: "out",
              quantity: item.quantity,
              reason: "Sold",
            },
          });
        }

        const itemDiscount = item.discount || 0;
        const itemTotal = (price - itemDiscount) * item.quantity;
        subtotal += itemTotal;

        orderItems.push({
          productId: item.productId,
          variantId: item.variantId || null,
          name: product.name,
          variantInfo,
          quantity: item.quantity,
          price,
          discount: itemDiscount,
          total: itemTotal,
        });
      }

      // Calculate total after discount
      let totalDiscount = discount;
      if (discountType === "percent") {
        totalDiscount = (subtotal * discount) / 100;
      }
      const total = subtotal - totalDiscount;
      const paidAmount = paid !== undefined ? paid : total;
      const debt = total - paidAmount;

      const orderNumber = generateOrderNumber();

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId: customerId || null,
          userId: user.id,
          subtotal,
          discount: totalDiscount,
          discountType,
          total,
          paid: paidAmount,
          debt: debt > 0 ? debt : 0,
          paymentMethod,
          note: note || null,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: true,
          customer: true,
          user: { select: { id: true, name: true } },
        },
      });

      // Update customer points and totalSpent
      if (customerId) {
        const pointsEarned = Math.floor(total / 1000);
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalSpent: { increment: total },
            points: { increment: pointsEarned },
            ...(debt > 0 && { debt: { increment: debt } }),
          },
        });
      }

      return newOrder;
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
