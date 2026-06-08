import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateSKU } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const active = searchParams.get("active");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (active !== null && active !== undefined && active !== "") {
      where.active = active === "true";
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          variants: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/products error:", error);
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
    const { name, categoryId, costPrice, sellPrice, description, barcode, image, variants } = body;

    if (!name || !categoryId) {
      return NextResponse.json({ error: "Name and category are required" }, { status: 400 });
    }

    const sku = generateSKU("SP");

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        barcode: barcode || null,
        description: description || null,
        categoryId,
        costPrice: costPrice || 0,
        sellPrice: sellPrice || 0,
        image: image || null,
        variants: variants?.length
          ? {
              create: variants.map((v: { size: string; color: string; costPrice?: number; sellPrice?: number; stock?: number; barcode?: string }) => ({
                size: v.size,
                color: v.color,
                sku: generateSKU("BT"),
                barcode: v.barcode || null,
                costPrice: v.costPrice || costPrice || 0,
                sellPrice: v.sellPrice || sellPrice || 0,
                stock: v.stock || 0,
              })),
            }
          : undefined,
      },
      include: {
        category: true,
        variants: true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("POST /api/products error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
