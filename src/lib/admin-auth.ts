import "server-only";

import { cookies } from "next/headers";

import { ADMIN_SESSION_DURATION_SECONDS, verifyAdminSessionToken } from "@/lib/admin-session";

export { createAdminSessionToken, verifyAdminPassword, verifyAdminSessionToken } from "@/lib/admin-session";

export const ADMIN_COOKIE_NAME = "clinic_admin_session";

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: ADMIN_SESSION_DURATION_SECONDS,
};
