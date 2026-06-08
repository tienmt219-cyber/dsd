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

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error("GET /api/customers/[id] error:", error);
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
    const { name, phone, email, address, note } = body;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    if (phone && phone !== existing.phone) {
      const phoneExists = await prisma.customer.findUnique({ where: { phone } });
      if (phoneExists) {
        return NextResponse.json({ error: "Phone number already exists" }, { status: 400 });
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(note !== undefined && { note }),
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("PUT /api/customers/[id] error:", error);
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

    const existing = await prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    if (existing._count.orders > 0) {
      return NextResponse.json(
        { error: "Cannot delete customer with existing orders" },
        { status: 400 }
      );
    }

    await prisma.customer.delete({ where: { id } });

    return NextResponse.json({ message: "Customer deleted" });
  } catch (error) {
    console.error("DELETE /api/customers/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
