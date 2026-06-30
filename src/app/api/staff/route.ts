import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword, checkPermission } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staff = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error("GET /api/staff error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkPermission(user.role, ["admin"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, role, phone } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);

    const staff = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || "staff",
        phone: phone || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    console.error("POST /api/staff error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
