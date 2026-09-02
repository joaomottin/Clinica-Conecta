import { NextResponse } from "next/server";

import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  createAdminSessionToken,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { ClinicServiceError } from "@/lib/clinic/service";
import { adminLoginSchema } from "@/lib/clinic/schemas";
import { apiError, requireSameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = adminLoginSchema.safeParse(await request.json());
    if (!parsed.success || !verifyAdminPassword(parsed.data.password)) {
      throw new ClinicServiceError("Senha administrativa inválida.", 401, "INVALID_ADMIN_CREDENTIALS");
    }

    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionToken(), adminCookieOptions);
    return response;
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const response = NextResponse.json({ authenticated: false });
    response.cookies.set(ADMIN_COOKIE_NAME, "", { ...adminCookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
