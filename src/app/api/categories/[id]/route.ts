import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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
    const { name, image } = body;

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      data.name = name;
      data.slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    if (image !== undefined) {
      data.image = image;
    }

    const category = await prisma.category.update({
      where: { id },
      data,
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("PUT /api/categories/[id] error:", error);
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

    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (existing._count.products > 0) {
      return NextResponse.json(
        { error: "Cannot delete category with existing products" },
        { status: 400 }
      );
    }

    await prisma.category.delete({ where: { id } });

    return NextResponse.json({ message: "Category deleted" });
  } catch (error) {
    console.error("DELETE /api/categories/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
