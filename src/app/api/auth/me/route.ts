import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      lastLoginLocation: true,
      lastLoginIp: true,
      lastLoginLat: true,
      lastLoginLng: true,
      lastLoginAddress: true,
      lastLoginPincode: true,
      lastLoginCity: true,
      lastLoginState: true,
      lastLoginCountry: true,
      lastLoginSource: true,
    },
  });

  return apiSuccess({
    userId: session.userId,
    email: session.email,
    fullName: session.fullName,
    roleCode: session.roleCode,
    permissions: session.permissions,
    lastLoginLocation: user?.lastLoginLocation ?? null,
    lastLoginIp: user?.lastLoginIp ?? null,
    lastLoginLat: user?.lastLoginLat ?? null,
    lastLoginLng: user?.lastLoginLng ?? null,
    lastLoginAddress: user?.lastLoginAddress ?? null,
    lastLoginPincode: user?.lastLoginPincode ?? null,
    lastLoginCity: user?.lastLoginCity ?? null,
    lastLoginState: user?.lastLoginState ?? null,
    lastLoginCountry: user?.lastLoginCountry ?? null,
    lastLoginSource: user?.lastLoginSource ?? null,
  });
}
