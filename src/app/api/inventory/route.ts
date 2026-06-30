import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type") || "";
    const productId = searchParams.get("productId") || "";
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }

    if (productId) {
      where.productId = productId;
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variant: { select: { id: true, size: true, color: true, sku: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return NextResponse.json({
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/inventory error:", error);
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
    const { productId, variantId, type, quantity, reason } = body;

    if (!productId || !type || quantity === undefined || quantity === null) {
      return NextResponse.json(
        { error: "productId, type, and quantity are required" },
        { status: 400 }
      );
    }

    if (!["in", "out", "adjustment"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be 'in', 'out', or 'adjustment'" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new Error("Product not found");
      }

      if (variantId) {
        const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
        if (!variant) {
          throw new Error("Variant not found");
        }

        if (type === "in") {
          await tx.productVariant.update({
            where: { id: variantId },
            data: { stock: { increment: quantity } },
          });
        } else if (type === "out") {
          if (variant.stock < quantity) {
            throw new Error("Insufficient stock");
          }
          await tx.productVariant.update({
            where: { id: variantId },
            data: { stock: { decrement: quantity } },
          });
        } else if (type === "adjustment") {
          // quantity is the new absolute stock value
          await tx.productVariant.update({
            where: { id: variantId },
            data: { stock: quantity },
          });
        }
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          variantId: variantId || null,
          type,
          quantity,
          reason: reason || null,
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variant: { select: { id: true, size: true, color: true, sku: true, stock: true } },
        },
      });

      return movement;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/inventory error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
