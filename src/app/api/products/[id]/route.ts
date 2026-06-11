import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("GET /api/products/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, categoryId, costPrice, sellPrice, description, barcode, image, active, variants } = body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(categoryId !== undefined && { categoryId }),
          ...(costPrice !== undefined && { costPrice }),
          ...(sellPrice !== undefined && { sellPrice }),
          ...(description !== undefined && { description }),
          ...(barcode !== undefined && { barcode }),
          ...(image !== undefined && { image }),
          ...(active !== undefined && { active }),
        },
      });

      if (variants && Array.isArray(variants)) {
        for (const v of variants) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                size: v.size,
                color: v.color,
                costPrice: v.costPrice,
                sellPrice: v.sellPrice,
                stock: v.stock,
                active: v.active,
                barcode: v.barcode || null,
              },
            });
          } else {
            const { generateSKU } = await import("@/lib/utils");
            await tx.productVariant.create({
              data: {
                productId: id,
                size: v.size,
                color: v.color,
                sku: generateSKU("BT"),
                barcode: v.barcode || null,
                costPrice: v.costPrice || updated.costPrice,
                sellPrice: v.sellPrice || updated.sellPrice,
                stock: v.stock || 0,
              },
            });
          }
        }
      }

      return tx.product.findUnique({
        where: { id },
        include: { category: true, variants: true },
      });
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("PUT /api/products/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await prisma.product.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ message: "Product deactivated" });
  } catch (error) {
    console.error("DELETE /api/products/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
